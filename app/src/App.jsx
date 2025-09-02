import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// --- COMPONENTES AUXILIARES ---
const formatCurrency = (value) => {
    if (typeof value !== 'number') return 'R$ 0,00';
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
const FinanceTracker = ({ auth, db, userId }) => {
    const [transactions, setTransactions] = useState([]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('receita');
    const [manualDate, setManualDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [isResponsiblePopupOpen, setIsResponsiblePopupOpen] = useState(false);
    const [parsingMessage, setParsingMessage] = useState({ message: '', type: '' });

    // Estados para CSV e funcionalidades extra
    const csvInputRef = useRef(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isClassifiedImport, setIsClassifiedImport] = useState(false);
    const [importer, setImporter] = useState('');
    const [knownClassifications, setKnownClassifications] = useState({});
    const [userFilter, setUserFilter] = useState('Todos');
    const [classificationFilter, setClassificationFilter] = useState('Todos');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeTab, setActiveTab] = useState('lancamentos');

    const expenseCategories = ["Aluguer", "Cuidados Pessoais", "Casa", "Plano de Saúde", "Crédito", "Estudos", "Farmácia", "Flag", "Gás", "Internet", "Lanche", "Transporte", "Eletricidade", "Supermercado", "Outros", "Animais de Estimação", "Raulzinho", "Poupanças", "Streamings"].sort();
    const revenueCategories = ["13º", "Bónus", "Férias", "Outros", "Rendimentos", "Salário"].sort();

    useEffect(() => {
        if (!db || !userId) return;

        const classificationsCollection = collection(db, `users/${userId}/classifications`);
        const unsubscribeClassifications = onSnapshot(classificationsCollection, (snapshot) => {
            const classifications = {};
            snapshot.forEach(doc => classifications[doc.id] = doc.data().category);
            setKnownClassifications(classifications);
        });

        const transactionsCollection = collection(db, `users/${userId}/transactions`);
        const unsubscribeTransactions = onSnapshot(query(transactionsCollection), (snapshot) => {
            let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Auto-classificar com base no conhecimento existente
            fetched = fetched.map(t => {
                if (!t.category && knownClassifications[t.description]) {
                    return { ...t, category: knownClassifications[t.description] };
                }
                return t;
            });
            fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setTransactions(fetched);
            setLoading(false);
        });

        return () => {
            unsubscribeClassifications();
            unsubscribeTransactions();
        };
    }, [db, userId]);

    const addTransaction = (e, responsible) => {
        e.preventDefault();
        if (!description || !amount || !manualDate) return setParsingMessage({ message: "Por favor, preencha todos os campos.", type: 'error' });
        const data = { description, amount: parseFloat(amount), type, importer: responsible, timestamp: new Date(manualDate) };
        addDoc(collection(db, `users/${userId}/transactions`), data).then(() => {
            setParsingMessage({ message: "Transação adicionada com sucesso!", type: 'success' });
            setDescription(''); setAmount(''); setManualDate(''); setIsResponsiblePopupOpen(false);
        });
    };
    
    const classifyTransaction = async (transactionId, description, category) => {
        const transDocRef = doc(db, `users/${userId}/transactions`, transactionId);
        await setDoc(transDocRef, { category: category }, { merge: true });

        const classDocRef = doc(db, `users/${userId}/classifications`, description);
        await setDoc(classDocRef, { category: category });
        setParsingMessage({ message: "Transação classificada!", type: 'success' });
    };

    const deleteTransaction = async (transactionId) => {
        await deleteDoc(doc(db, `users/${userId}/transactions`, transactionId));
        setParsingMessage({ message: "Transação apagada.", type: 'success' });
    };

    const handleCsvUpload = async () => {
        // ... (código de importação de CSV)
    };

    // ... (Cálculos para os gráficos, filtros, etc.)
    const filteredTransactions = transactions.filter(t => {
        const transactionDate = t.timestamp?.toDate();
        if (!transactionDate) return false;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && transactionDate < start) return false;
        if (end && transactionDate > end) return false;
        if (userFilter !== 'Todos' && t.importer !== userFilter) return false;
        if (classificationFilter === 'Classificados' && !t.category) return false;
        if (classificationFilter === 'A Classificar' && t.category) return false;
        return true;
    });

    const totalRevenue = filteredTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);

    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
            <StatusMessage message={parsingMessage.message} type={parsingMessage.type} onClose={() => setParsingMessage({message: '', type: ''})} />
            <div className="max-w-4xl mx-auto space-y-8">
                 <header className="p-6 bg-white rounded-xl shadow-lg flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">ContadorZinho</h1>
                    <button onClick={() => signOut(auth)} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">Sair</button>
                </header>

                <div className="flex justify-center gap-4 bg-white p-2 rounded-xl shadow-lg">
                    <button onClick={() => setActiveTab('lancamentos')} className={`py-2 px-4 rounded-md text-sm font-medium transition ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200'}`}>
                        Lançamentos
                    </button>
                    <button onClick={() => setActiveTab('graficos')} className={`py-2 px-4 rounded-md text-sm font-medium transition ${activeTab === 'graficos' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-200'}`}>
                        Gráficos
                    </button>
                </div>

                {activeTab === 'lancamentos' && (
                    <>
                        <section className="grid md:grid-cols-2 gap-6">
                           <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                             <h2 className="text-lg font-semibold text-gray-600">Receita Total</h2>
                             <p className="mt-2 text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                           </div>
                           <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                             <h2 className="text-lg font-semibold text-gray-600">Despesa Total</h2>
                             <p className="mt-2 text-3xl font-bold text-red-600">{formatCurrency(Math.abs(totalExpense))}</p>
                           </div>
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-lg">
                          <h2 className="text-2xl font-bold mb-4">Adicionar Nova Transação</h2>
                          {/* Formulário de Adicionar Transação aqui */}
                        </section>

                         <section className="bg-white p-6 rounded-xl shadow-lg">
                          <h2 className="text-2xl font-bold mb-4">Importar CSV</h2>
                           {/* Funcionalidade de Importar CSV aqui */}
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-lg">
                            <h2 className="text-2xl font-bold mb-4">Histórico de Transações</h2>
                            {/* Filtros e Lista de Transações aqui */}
                            {filteredTransactions.map(t => (
                                <div key={t.id} className="py-4 flex justify-between items-center border-b">
                                    <div>
                                        <p className="font-medium">{t.description}</p>
                                        <p className="text-sm text-gray-500">{t.timestamp?.toDate().toLocaleDateString('pt-BR')}</p>
                                        <select value={t.category || ''} onChange={(e) => classifyTransaction(t.id, t.description, e.target.value)} className="mt-1 text-xs rounded">
                                            <option value="">Classificar</option>
                                            {(t.type === 'receita' ? revenueCategories : expenseCategories).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <span className={`font-semibold ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                        </section>
                    </>
                )}
                
                {activeTab === 'graficos' && (
                    <section className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">Gráficos e Análises</h2>
                        <p className="text-center text-gray-500">A secção de gráficos estará aqui.</p>
                        {/* Componentes de Gráficos aqui */}
                    </section>
                )}

            </div>
        </div>
    );
};


// --- TELA DE LOGIN E REGISTO ---
const AuthScreen = ({ auth }) => {
    // ... (código da tela de login, sem alterações)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) await signInWithEmailAndPassword(auth, email, password);
            else await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center mb-6">{isLogin ? 'Login' : 'Registo'}</h2>
                <form onSubmit={handleAuthAction} className="space-y-6">
                    <div>
                        <label>Email</label>
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label>Senha</label>
                        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                        {isLogin ? 'Entrar' : 'Criar Conta'}
                    </button>
                </form>
                <div className="text-center mt-6">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                        {isLogin ? 'Não tem uma conta? Registe-se' : 'Já tem uma conta? Faça login'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL QUE GERE A VISUALIZAÇÃO ---
function App() {
    // ... (código do App principal, sem alterações)
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('loading');

    useEffect(() => {
        try {
            const firebaseConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID,
                measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
            };
            
            if (!firebaseConfig.apiKey) {
                console.error("Chaves do Firebase não foram carregadas.");
            }

            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            setDb(db);
            setAuth(auth);

            onAuthStateChanged(auth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setView('app');
                } else {
                    setUserId(null);
                    setView('auth');
                }
            });
        } catch (e) {
            console.error("Erro na inicialização do Firebase:", e);
            setView('auth');
        }
    }, []);

    if (view === 'loading') return <LoadingScreen />;
    if (view === 'auth') return <AuthScreen auth={auth} />;
    if (view === 'app') return <FinanceTracker auth={auth} db={db} userId={userId} />;
    
    return <LoadingScreen />; // Fallback
}

export default App;

