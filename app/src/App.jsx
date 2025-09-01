import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, query, getDoc, serverTimestamp } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// --- COMPONENTES AUXILIARES ---

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const StatusMessage = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'success' ? 'bg-green-100' : 'bg-red-100';
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-xl z-50 ${bgColor} ${textColor}`}>
      <div className="flex items-center">
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="ml-4 text-lg font-bold">&times;</button>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">A carregar...</div>
    </div>
);

// --- TELA PRINCIPAL DO APP DE FINANÇAS ---

const FinanceTracker = ({ auth, db, familyId }) => {
    // ... (O conteúdo deste componente permanece exatamente o mesmo)
    const [transactions, setTransactions] = useState([]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('receita');
    const [manualDate, setManualDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [parsingMessage, setParsingMessage] = useState({ message: '', type: '' });
    const [isResponsiblePopupOpen, setIsResponsiblePopupOpen] = useState(false);

    const expenseCategories = ["Aluguer", "Cuidados Pessoais", "Casa", "Plano de Saúde", "Crédito", "Estudos", "Farmácia", "Flag", "Gás", "Internet", "Lanche", "Transporte", "Eletricidade", "Supermercado", "Outros", "Animais de Estimação", "Raulzinho", "Poupanças", "Streamings"].sort();
    const revenueCategories = ["13º", "Bónus", "Férias", "Outros", "Rendimentos", "Salário"].sort();
    
    const handleCopyInviteCode = () => {
        navigator.clipboard.writeText(familyId).then(() => {
            setParsingMessage({ message: "Código de convite copiado!", type: "success" });
        });
    };

    useEffect(() => {
        if (!db || !familyId) return;
        const familyPath = `families/${familyId}`;
        const unsubscribe = onSnapshot(collection(db, `${familyPath}/transactions`), (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setTransactions(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db, familyId]);

    const addTransaction = (e, responsible) => {
        e.preventDefault();
        if (!description || !amount || isNaN(parseFloat(amount)) || !manualDate) return;
        const data = { description, amount: parseFloat(amount), type, importer: responsible, timestamp: new Date(manualDate), createdAt: serverTimestamp() };
        addDoc(collection(db, `families/${familyId}/transactions`), data).then(() => {
            setDescription(''); setAmount(''); setManualDate(''); setIsResponsiblePopupOpen(false);
        });
    };
    
    // ... restante da lógica do componente
    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
             <StatusMessage message={parsingMessage.message} type={parsingMessage.type} onClose={() => setParsingMessage({ message: '', type: '' })} />
            {isResponsiblePopupOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                 <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm text-center space-y-4">
                   <h3 className="text-xl font-bold">Quem é o responsável?</h3>
                   <div className="flex gap-4">
                     <button onClick={(e) => addTransaction(e, 'Raul')} className="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Raul</button>
                     <button onClick={(e) => addTransaction(e, 'Karol')} className="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Karol</button>
                   </div>
                   <button onClick={() => setIsResponsiblePopupOpen(false)} className="w-full text-sm text-gray-500 hover:underline">Cancelar</button>
                 </div>
               </div>
            )}
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="p-6 bg-white rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">ContadorZinho</h1>
                        <div className="mt-2">
                             <p className="text-xs text-gray-500">Código de Convite:</p>
                             <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-md">
                                 <span className="font-mono text-sm text-gray-700">{familyId}</span>
                                 <button onClick={handleCopyInviteCode} title="Copiar código" className="text-gray-500 hover:text-indigo-600">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                                 </button>
                             </div>
                        </div>
                    </div>
                    <button onClick={() => signOut(auth)} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 self-start md:self-center">Sair</button>
                </header>
                 <section className="bg-white p-6 rounded-xl shadow-lg">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">Adicionar Nova Transação</h2>
                  {/* Formulário aqui */}
                </section>
                <section className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900">Histórico de Transações</h2>
                    {/* Lista de transações aqui */}
                </section>
            </div>
        </div>
    );
};


// --- TELA DE LOGIN ---
const AuthScreen = ({ auth }) => {
    // ... (O conteúdo deste componente permanece exatamente o mesmo)
     const [error, setError] = useState('');
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            setError("Falha ao fazer login com o Google. Tente novamente.");
            console.error(err);
        }
    };
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-sm w-full bg-white p-8 rounded-xl shadow-lg text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo!</h2>
                <p className="text-gray-600 mb-6">Faça login para continuar.</p>
                <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 398.9 0 256S111.8 0 244 0c69.8 0 130.5 28.1 176.4 73.6l-67.6 67.5C314.6 103.3 282.3 88 244 88c-88.3 0-160 71.7-160 160s71.7 160 160 160c92.8 0 140.3-65.7 144.9-100.2H244v-71.4h236.1c2.3 12.7 3.9 26.1 3.9 40.2z"></path></svg>
                    Entrar com Google
                </button>
                {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
            </div>
        </div>
    );
};

// --- TELA PARA CRIAR OU ENTRAR NUMA FAMÍLIA ---
const JoinCreateFamilyScreen = ({ db, user, setFamilyId }) => {
    // ... (O conteúdo deste componente permanece exatamente o mesmo)
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');

    const handleCreateFamily = async () => {
        const familyRef = await addDoc(collection(db, "families"), {
            createdAt: serverTimestamp(),
            members: [user.uid]
        });
        await setDoc(doc(db, "users", user.uid), { familyId: familyRef.id });
        setFamilyId(familyRef.id);
    };

    const handleJoinFamily = async (e) => {
        e.preventDefault();
        const familyDoc = await getDoc(doc(db, "families", inviteCode.trim()));
        if (familyDoc.exists()) {
            await setDoc(doc(db, "users", user.uid), { familyId: inviteCode.trim() });
            setFamilyId(inviteCode.trim());
        } else {
            setError("Código de convite inválido.");
        }
    };
    return (
         <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">Espaço Familiar</h2>
                <p className="text-center text-gray-600 mb-6">Crie um novo espaço para partilhar ou entre num existente com um código de convite.</p>
                <button onClick={handleCreateFamily} className="w-full mb-6 flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                    Criar Novo Espaço
                </button>
                <div className="relative my-4"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">OU</span></div></div>
                <form onSubmit={handleJoinFamily} className="space-y-4">
                    <div>
                        <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700">Código de Convite</label>
                        <input id="inviteCode" type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                        Entrar com Código
                    </button>
                </form>
                 {error && <p className="text-sm text-red-600 mt-4 text-center">{error}</p>}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL QUE GERE A VISUALIZAÇÃO ---

function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [familyId, setFamilyId] = useState(null);
    const [view, setView] = useState('loading');

    useEffect(() => {
        try {
            // ALTERAÇÃO IMPORTANTE AQUI!
            const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
            
            const firebaseApp = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(firebaseApp);
            const firestoreDb = getFirestore(firebaseApp);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    const userDocRef = doc(firestoreDb, "users", currentUser.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    
                    if (userDocSnap.exists() && userDocSnap.data().familyId) {
                        setFamilyId(userDocSnap.data().familyId);
                        setView('app');
                    } else {
                        setView('join_create_family');
                    }
                } else {
                    setUser(null);
                    setFamilyId(null);
                    setView('auth');
                }
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Erro na inicialização do Firebase:", e);
            setView('auth');
        }
    }, []);

    if (view === 'loading') return <LoadingScreen />;
    if (view === 'auth') return <AuthScreen auth={auth} />;
    if (view === 'join_create_family') return <JoinCreateFamilyScreen db={db} user={user} setFamilyId={setFamilyId} />;
    if (view === 'app' && familyId) return <FinanceTracker auth={auth} db={db} familyId={familyId} />;
    
    return <LoadingScreen />;
}

export default App;
