// Configurações e dependências para Cloud Functions
// Certifique-se de que o projeto Firebase esteja inicializado com "firebase init"
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// A Cloud Function será executada com as credenciais do Admin SDK,
// dando-lhe acesso total aos seus dados do Firestore.
admin.initializeApp();
const db = admin.firestore();

// --- FUNÇÃO PRINCIPAL: Checa Lembretes a cada 5 minutos ---
// Esta função é agendada para rodar a cada 5 minutos usando o Cloud Scheduler do Google.
// IMPORTANTE: Isso requer um plano de pagamento "Blaze" (Pay As You Go) no Firebase,
// mas a tier gratuita geralmente cobre o uso leve.
exports.checkReminders = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    console.log('Iniciando checagem de lembretes...');
    
    // Ponto de corte: Qualquer notificação agendada para este momento ou antes.
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    // 1. Checar Lembretes do CALENDÁRIO
    // Busca em todas as subcoleções 'calendarEvents' onde nextNotification <= now e status == 'active'
    const calendarQuery = db.collectionGroup('calendarEvents')
        .where('nextNotification', '<=', now)
        .where('status', '==', 'active') 
        .limit(50); 

    const calendarSnapshot = await calendarQuery.get();
    
    if (calendarSnapshot.empty) {
        console.log('Nenhum lembrete de calendário pendente.');
    } else {
        console.log(`Encontrados ${calendarSnapshot.size} lembretes de calendário para processar.`);
        for (const doc of calendarSnapshot.docs) {
            const event = doc.data();
            // A Cloud Function precisa navegar quatro níveis acima para encontrar o UID do usuário.
            const userId = doc.ref.parent.parent.parent.parent.id; 

            // Agenda a notificação, calcula a próxima ocorrência (se recorrente) e prepara o update.
            const nextBatchUpdate = await scheduleNotification(doc, userId, event, 'evento');
            
            if (nextBatchUpdate) {
                 nextBatchUpdate.forEach(op => {
                    if (op.type === 'update') {
                        batch.update(op.ref, op.data);
                    }
                });
            }
        }
    }

    // 2. Checar Lembretes de MISSÕES (To-Do)
    // Busca em todas as subcoleções 'todos' onde nextNotification <= now e status == 'pending'
    const todosQuery = db.collectionGroup('todos')
        .where('nextNotification', '<=', now)
        .where('status', '==', 'pending')
        .limit(50);

    const todosSnapshot = await todosQuery.get();

    if (todosSnapshot.empty) {
        console.log('Nenhuma missão pendente para lembrete.');
    } else {
        console.log(`Encontradas ${todosSnapshot.size} missões para processar.`);
        for (const doc of todosSnapshot.docs) {
            const todo = doc.data();
            const userId = doc.ref.parent.parent.parent.parent.id; 

            // Agenda a notificação e prepara o update
            const nextBatchUpdate = await scheduleNotification(doc, userId, todo, 'missão');
            
            if (nextBatchUpdate) {
                 nextBatchUpdate.forEach(op => {
                    if (op.type === 'update') {
                        batch.update(op.ref, op.data);
                    }
                });
            }
        }
    }

    // Executa todas as atualizações de status e agendamento de próxima notificação
    await batch.commit();
    console.log('Checagem de lembretes concluída e batch commit executado.');
    return null;
});


// --- FUNÇÃO AUXILIAR: Envia a Notificação Push e Agenda a Próxima ---
/**
 * @param {admin.firestore.DocumentSnapshot} doc - O snapshot do documento (evento/missão).
 * @param {string} userId - O UID do usuário proprietário.
 * @param {object} item - Os dados do evento/missão.
 * @param {'evento'|'missão'} type - O tipo de item para formatar a mensagem.
 * @returns {Array<{type: 'update', ref: admin.firestore.DocumentReference, data: object}>} - Array de operações de batch.
 */
async function scheduleNotification(doc, userId, item, type) {
    const docRef = doc.ref;
    const batchOperations = [];
    
    // 1. Enviar Notificação
    // Busca os tokens do usuário (salvos pelo Front-end)
    const tokensSnapshot = await db.collection(`users/${userId}/fcmTokens`).get();
    const tokens = tokensSnapshot.docs.map(doc => doc.id);

    if (tokens.length > 0) {
        const title = type === 'evento' ? `Lembrete: ${item.title}` : `Missão Pendente: ${item.title}`;
        const body = type === 'evento' 
            ? `O seu evento '${item.title}' está a chegar!`
            : `A missão '${item.title}' (${item.responsible || 'Sem Responsável'}) tem data limite hoje.`;

        const message = {
            notification: {
                title: title,
                body: body,
            },
            // Dados personalizados para saber onde ir no app ao clicar na notificação
            data: {
                view: type === 'evento' ? 'calendar' : 'todo',
                id: doc.id
            },
            tokens: tokens, // Lista de tokens para envio
        };

        try {
            await admin.messaging().sendMulticast(message); // Envio para múltiplos tokens
            console.log(`Notificação enviada para ${tokens.length} dispositivos do usuário ${userId}.`);
        } catch (error) {
            console.error(`Erro ao enviar notificação para o usuário ${userId}:`, error);
        }
    }
    
    // 2. Calcular a Próxima Notificação e Atualizar Status

    // Para Missões e eventos não recorrentes, marcamos como 'sent' (enviado) e removemos o agendamento.
    if (item.frequency === 'none' || type === 'missão') {
        batchOperations.push({
            type: 'update',
            ref: docRef,
            data: { status: 'sent', nextNotification: null }
        });
    } 
    // Lógica de recorrência para eventos de CALENDÁRIO
    else if (type === 'evento' && item.frequency !== 'none') {
        // Calcula a próxima data de notificação
        const nextDate = calculateNextRecurrence(item.start.toDate(), item.frequency, item.reminder);
        
        if (nextDate) {
            // Agenda a próxima notificação.
            batchOperations.push({
                type: 'update',
                ref: docRef,
                data: {
                    nextNotification: nextDate,
                    status: 'active'
                }
            });
        } else {
            // Se o cálculo não encontrar a próxima data, marca como finalizado.
            batchOperations.push({
                type: 'update',
                ref: docRef,
                data: { status: 'completed', nextNotification: null }
            });
        }
    }
    
    return batchOperations;
}

// --- FUNÇÃO AUXILIAR: Cálculo de Recorrência (Simplificada) ---
/**
 * @param {Date} startDate - A data de início do evento.
 * @param {'daily'|'weekly'|'monthly'} frequency - Frequência de repetição.
 * @param {'15m'|'1h'|'1d'} reminder - O deslocamento do lembrete.
 * @returns {Date | null} - A data e hora da próxima notificação.
 */
function calculateNextRecurrence(startDate, frequency, reminder) {
    const nextDate = new Date(startDate.getTime());

    // 1. Avança a data para a próxima ocorrência
    if (frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
    } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
    } else if (frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
        return null; // Não recorrente
    }

    // 2. Aplica o deslocamento do lembrete (15m, 1h, 1d)
    const reminderOffsetMs = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
    }[reminder] || 0; // Se 'none' for passado, o offset será 0, e a notificação será enviada na hora do evento.

    const nextNotificationTime = new Date(nextDate.getTime() - reminderOffsetMs);
    
    // Se a próxima data calculada estiver no passado, pula. 
    if (nextNotificationTime.getTime() < Date.now()) {
        return null; 
    }

    return nextNotificationTime;
}
```

### Próximos Passos (Pronto para o Deploy)

1.  **Copie e Cole:** Certifique-se de que o `functions/index.js` no seu Codespace agora contenha o código acima.
2.  **Deploy:** Execute o comando de deploy a partir da raiz do seu projeto (no terminal do Codespace):
    ```bash
    firebase deploy --only functions
    
