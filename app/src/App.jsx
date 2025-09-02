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
    const [isAddTransactionPopupOpen, setIsAddTransactionPopupOpen] = useState(false);
    const [isResponsiblePopupOpen, setIsResponsiblePopupOpen] = useState(false);
    const [parsingMessage, setParsingMessage] = useState({ message: '', type: '' });

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
            fetched = fetched.map(t => ({ ...t, category: t.category || knownClassifications[t.description] || null }));
            fetched.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setTransactions(fetched);
            setLoading(false);
        });

        return () => {
            unsubscribeClassifications();
            unsubscribeTransactions();
        };
    }, [db, userId, knownClassifications]);

    const handleAddTransactionClick = () => {
        if (!description || !amount || !manualDate) {
            setParsingMessage({ message: "Por favor, preencha todos os campos do formulário.", type: 'error' });
            return;
        }
        setIsResponsiblePopupOpen(true);
    };

    const addTransaction = (e, responsible) => {
        e.preventDefault();
        const data = { description, amount: parseFloat(amount), type, importer: responsible, timestamp: new Date(manualDate) };
        addDoc(collection(db, `users/${userId}/transactions`), data).then(() => {
            setParsingMessage({ message: "Transação adicionada com sucesso!", type: 'success' });
            setDescription(''); setAmount(''); setManualDate(''); 
            setIsResponsiblePopupOpen(false);
            setIsAddTransactionPopupOpen(false);
        });
    };
    
    const classifyTransaction = async (transactionId, field, value) => {
        await setDoc(doc(db, `users/${userId}/transactions`, transactionId), { [field]: value }, { merge: true });
        if (field === 'category') {
            const transaction = transactions.find(t => t.id === transactionId);
            if (transaction) {
                await setDoc(doc(db, `users/${userId}/classifications`, transaction.description), { category: value });
            }
        }
    };

    const deleteTransaction = async (transactionId) => {
        await deleteDoc(doc(db, `users/${userId}/transactions`, transactionId));
        setParsingMessage({ message: "Transação apagada.", type: 'success' });
    };

    const parseCsvText = (text, isClassified = false) => { /* ... sua lógica de CSV ... */ return []; };
    const handleCsvUpload = async () => { /* ... sua lógica de CSV ... */ };
    
    const exportClassifiedData = () => {
        const header = "Data;Descrição;Tipo;Valor;Categoria;Importador";
        const csvRows = [header];
        filteredTransactions.forEach(t => {
            const date = t.timestamp?.toDate().toLocaleDateString('pt-BR') || '';
            const description = `"${(t.description || '').replace(/"/g, '""')}"`;
            const type = t.type || '';
            const amount = t.amount?.toString().replace('.', ',') || '0,00';
            const category = t.category || '';
            const importer = t.importer || '';
            csvRows.push([date, description, type, amount, category, importer].join(';'));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `lancamentos_classificados_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredTransactions = transactions.filter(t => {
        const transactionDate = t.timestamp?.toDate();
        if (!transactionDate) return false;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && transactionDate < start) return false;
        if (end && transactionDate > end) return false;
        if (userFilter !== 'Todos' && t.importer !== userFilter) return false;
        if (classificationFilter === 'Classificados' && !t.category) return false;
        if (classificationFilter === 'A Classificar' && t.category) return false;
        return true;
    });

    const totalRevenue = filteredTransactions.filter(t => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0);
    const totalBalance = totalRevenue + totalExpense;
    
    const barChartData = [];
    const unclassifiedCount = transactions.filter(t => !t.category).length;
    const totalRaul = transactions.filter(t => t.importer === 'Raul').length;
    const classifiedRaul = transactions.filter(t => t.importer === 'Raul' && t.category).length;
    const raulProgress = totalRaul > 0 ? (classifiedRaul / totalRaul) * 100 : 0;
    const totalKarol = transactions.filter(t => t.importer === 'Karol').length;
    const classifiedKarol = transactions.filter(t => t.importer === 'Karol' && t.category).length;
    const karolProgress = totalKarol > 0 ? (classifiedKarol / totalKarol) * 100 : 0;

    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-800">
            <StatusMessage message={parsingMessage.message} type={parsingMessage.type} onClose={() => setParsingMessage({message: '', type: ''})} />

            {isAddTransactionPopupOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-4">
                        <h2 className="text-2xl font-bold mb-4">Adicionar Nova Transação</h2>
                        <form className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor" className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <select value={type} onChange={(e) => setType(e.target.value)} className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"><option value="receita">Receita</option><option value="despesa">Despesa</option></select>
                            <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="flex-1 mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => setIsAddTransactionPopupOpen(false)} className="py-2 px-4 rounded-md text-sm font-medium bg-gray-200 hover:bg-gray-300">Cancelar</button>
                            <button type="button" onClick={handleAddTransactionClick} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Avançar</button>
                        </div>
                        </form>
                    </div>
                 </div>
            )}

            {isResponsiblePopupOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm text-center space-y-4">
                    <h3 className="text-xl font-bold">Quem é o responsável?</h3>
                    <div className="flex gap-4">
                      <button onClick={(e) => addTransaction(e, 'Raul')} className="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Raul</button>
                      <button onClick={(e) => addTransaction(e, 'Karol')} className="flex-1 py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Karol</button>
                    </div>
                    <button onClick={() => setIsResponsiblePopupOpen(false)} className="w-full text-sm text-gray-500 hover:underline">Voltar</button>
                  </div>
                </div>
            )}
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="p-6 bg-white rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-bold text-gray-900 self-center md:self-start">ContadorZinho</h1>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <div className="flex gap-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md text-sm w-36"/>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md text-sm w-36"/>
                        </div>
                        <button onClick={() => signOut(auth)} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 w-full sm:w-auto">Sair</button>
                    </div>
                </header>

                <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
                  <h2 className="text-xl font-bold">Progresso de Classificação</h2>
                  <div className="space-y-2">
                    <p className="text-sm">Karol: {classifiedKarol}/{totalKarol} ({karolProgress.toFixed(0)}%)</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${karolProgress}%` }}></div></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm">Raul: {classifiedRaul}/{totalRaul} ({raulProgress.toFixed(0)}%)</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-blue-400 h-2.5 rounded-full" style={{ width: `${raulProgress}%` }}></div></div>
                  </div>
                </div>

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
                        <section className="grid md:grid-cols-3 gap-6">
                           <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                             <h2 className="text-lg font-semibold text-gray-600">Receita Total</h2>
                             <p className="mt-2 text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                           </div>
                           <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                             <h2 className="text-lg font-semibold text-gray-600">Despesa Total</h2>
                             <p className="mt-2 text-3xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
                           </div>
                           <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                             <h2 className="text-lg font-semibold text-gray-600">Saldo</h2>
                             <p className={`mt-2 text-3xl font-bold ${totalBalance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{formatCurrency(totalBalance)}</p>
                           </div>
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-lg text-center">
                           <button onClick={() => setIsAddTransactionPopupOpen(true)} className="w-full md:w-auto py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                             Adicionar Nova Transação
                           </button>
                        </section>
                        
                        <section className="bg-white p-6 rounded-xl shadow-lg">
                          <h2 className="text-2xl font-bold mb-4">Importar Extratos</h2>
                            <div className="flex-1 space-y-4 border p-4 rounded-md">
                              <h3 className="text-lg font-semibold text-gray-800">CSV</h3>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" id="importClassified" checked={isClassifiedImport} onChange={(e) => setIsClassifiedImport(e.target.checked)} className="h-4 w-4 text-purple-600 border-gray-300 rounded"/>
                                <label htmlFor="importClassified" className="text-sm text-gray-600">Importar ficheiro já classificado</label>
                              </div>
                              {!isClassifiedImport && (
                                  <div className="flex gap-4">
                                    <button onClick={() => setImporter('Raul')} className={`flex-1 py-2 px-4 rounded-md text-sm ${importer === 'Raul' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Raul</button>
                                    <button onClick={() => setImporter('Karol')} className={`flex-1 py-2 px-4 rounded-md text-sm ${importer === 'Karol' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Karol</button>
                                  </div>
                              )}
                              <input type="file" ref={csvInputRef} accept=".csv" className="block w-full text-sm"/>
                              <button onClick={handleCsvUpload} disabled={isParsing} className="w-full py-2 px-4 rounded-md text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50">{isParsing ? 'A importar...' : 'Importar CSV'}</button>
                            </div>
                        </section>

                        <section className="bg-white p-6 rounded-xl shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">Histórico ({unclassifiedCount} por classificar)</h2>
                                <button onClick={exportClassifiedData} className="py-1 px-3 rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700">Exportar</button>
                            </div>
                             <div className="flex flex-wrap gap-2 mb-4">
                               <button onClick={() => setClassificationFilter('Todos')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'Todos' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}>Todas</button>
                               <button onClick={() => setClassificationFilter('Classificados')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'Classificados' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Classificadas</button>
                               <button onClick={() => setClassificationFilter('A Classificar')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'A Classificar' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>A Classificar</button>
                             </div>
                            {filteredTransactions.map(t => (
                                <div key={t.id} className="py-4 flex justify-between items-center border-b">
                                    <div>
                                        <p className="font-medium">{t.description}</p>
                                        <p className="text-sm text-gray-500">{t.timestamp?.toDate().toLocaleDateString('pt-BR')}</p>
                                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                                            {t.importer && <span className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${t.importer === 'Raul' ? 'bg-blue-400' : 'bg-purple-600'}`}>{t.importer}</span>}
                                            <select value={t.category || ''} onChange={(e) => classifyTransaction(t.id, 'category', e.target.value)} className="text-xs rounded border-gray-300 p-1">
                                                <option value="">Classificar</option>
                                                {(t.type === 'receita' ? revenueCategories : expenseCategories).map(cat => ( <option key={cat} value={cat}>{cat}</option> ))}
                                            </select>
                                            <button onClick={() => deleteTransaction(t.id)} className="text-red-500 hover:text-red-700 text-xs p-1">Apagar</button>
                                        </div>
                                    </div>
                                    <span className={`font-semibold ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                        </section>
                    </>
                )}
                
                {activeTab === 'graficos' && (
                    <section className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold mb-4">Total por Categoria</h2>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={barChartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={150} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="total" fill="#8884d8" name="Total Gasto" />
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}
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
                console.error("Chaves do Firebase não foram carregadas. Verifique as variáveis de ambiente na Vercel.");
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

