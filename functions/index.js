const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendCalendarNotification = functions.firestore
    .document('users/{userId}/calendarEvents/{eventId}')
    .onCreate(async (snap, context) => {
        const newEvent = snap.data();
        const { userId } = context.params;

        // Se o evento não tiver lembrete, não fazemos nada.
        if (newEvent.reminder === 'none') {
            return null;
        }

        // Busca o token de notificação do usuário
        const userTokensRef = admin.firestore().collection(`users/${userId}/fcmTokens`);
        const tokensSnapshot = await userTokensRef.get();

        const tokens = tokensSnapshot.docs.map(doc => doc.id);

        if (!tokens.length) {
            console.log("Nenhum token de registro encontrado para o usuário.");
            return null;
        }
        
        // Define o corpo da notificação baseado no lembrete
        let reminderMessage = "Seu evento está prestes a começar!";
        switch(newEvent.reminder) {
            case '15m':
                reminderMessage = `Lembrete: O evento "${newEvent.title}" começa em 15 minutos.`;
                break;
            case '1h':
                reminderMessage = `Lembrete: O evento "${newEvent.title}" começa em 1 hora.`;
                break;
            case '1d':
                reminderMessage = `Lembrete: O evento "${newEvent.title}" começa em 1 dia.`;
                break;
            default:
                break;
        }

        const payload = {
            notification: {
                title: 'Lembrete de Evento',
                body: reminderMessage,
            },
            data: {
                eventTitle: newEvent.title
            }
        };

        // Envia a notificação para todos os tokens do usuário
        const response = await admin.messaging().sendToDevice(tokens, payload);
        console.log('Notificações enviadas com sucesso:', response);

        return null;
    });
