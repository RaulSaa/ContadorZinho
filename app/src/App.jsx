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

// --- COMPONENTES AUXILIARES ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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

    useEffect(() => {
        if (!db || !userId) return;
        const transactionsCollection = collection(db, `users/${userId}/transactions`);
        const unsubscribe = onSnapshot(query(transactionsCollection), (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setTransactions(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db, userId]);

    const addTransaction = (e, responsible) => {
        e.preventDefault();
        if (!description || !amount || !manualDate) return;
        const data = { description, amount: parseFloat(amount), type, importer: responsible, timestamp: new Date(manualDate) };
        addDoc(collection(db, `users/${userId}/transactions`), data).then(() => {
            setDescription(''); setAmount(''); setManualDate(''); setIsResponsiblePopupOpen(false);
        });
    };

    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
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
                <header className="p-6 bg-white rounded-xl shadow-lg flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">ContadorZinho</h1>
                    <button onClick={() => signOut(auth)} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">Sair</button>
                </header>
                 <section className="bg-white p-6 rounded-xl shadow-lg">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">Adicionar Nova Transação</h2>
                  <form className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <select value={type} onChange={(e) => setType(e.target.value)} className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
                      <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <button type="button" onClick={() => setIsResponsiblePopupOpen(true)} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Adicionar Transação</button>
                  </form>
                </section>
                <section className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900">Histórico de Transações</h2>
                    {transactions.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {transactions.map((t) => (
                                <li key={t.id} className="py-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{t.description}</p>
                                        <p className="text-sm text-gray-500">{t.timestamp?.toDate().toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <span className={`font-semibold ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (<p className="text-center text-gray-500">Nenhuma transação.</p>)}
                </section>
            </div>
        </div>
    );
};

// --- TELA DE LOGIN E REGISTO ---
const AuthScreen = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message.replace('Firebase: ', '').replace('Error ', '').replace(/ \(auth.*\)\.?/, ''));
        }
    };
    
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">{isLogin ? 'Login' : 'Registo'}</h2>
                <form onSubmit={handleAuthAction} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
                        <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
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
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('loading');

    useEffect(() => {
        try {
            // CORREÇÃO DEFINITIVA: Montar o objeto a partir de variáveis individuais
            const firebaseConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID,
                measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
            };
            
            // Verifica se as chaves foram carregadas
            if (!firebaseConfig.apiKey) {
                console.error("Chaves do Firebase não foram carregadas. Verifique as variáveis de ambiente na Vercel.");
                setView('auth'); // Mostra a tela de login, mas a inicialização falhará
                return;
            }

            const firebaseApp = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(firebaseApp);
            const firestoreDb = getFirestore(firebaseApp);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setView('app');
                } else {
                    setUserId(null);
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
    if (view === 'app') return <FinanceTracker auth={auth} db={db} userId={userId} />;
    
    return <LoadingScreen />;
}

export default App;

