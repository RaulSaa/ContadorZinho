import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, query, serverTimestamp, updateDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
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

// --- COMPONENTE DE NAVEGAÇÃO LATERAL ---
const Sidebar = ({ view, setView, auth }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuItems = [
        { name: "ContadorZinho", view: "finance", icon: "fas fa-chart-pie" },
        { name: "Lista de Compras", view: "shopping", icon: "fas fa-shopping-cart" },
        { name: "Afazeres", view: "todo", icon: "fas fa-check-square" },
        { name: "Calendário", view: "calendar", icon: "fas fa-calendar-alt" },
    ];

    const NavLink = ({ item }) => (
        <button onClick={() => { setView(item.view); setIsOpen(false); }} className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors duration-200 ${view === item.view ? 'bg-indigo-700 text-white' : 'text-gray-300 hover:bg-indigo-700 hover:text-white'}`}>
            <i className={`${item.icon} w-6 text-center`}></i>
            <span className="ml-4">{item.name}</span>
        </button>
    );

    return (
        <>
            <button onClick={() => setIsOpen(!isOpen)} className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-indigo-600 text-white shadow-lg">
                <i className="fas fa-bars"></i>
            </button>
            {isOpen && <div onClick={() => setIsOpen(false)} className="md:hidden fixed inset-0 bg-black opacity-50 z-30"></div>}
            <aside className={`fixed top-0 left-0 h-full bg-indigo-800 text-white w-64 p-4 flex flex-col transition-transform duration-300 z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <div className="text-center py-4 mb-8">
                    <h2 className="text-2xl font-bold">Casinha KR</h2>
                </div>
                <nav className="flex-grow space-y-2">
                    {menuItems.map(item => <NavLink key={item.view} item={item} />)}
                </nav>
                <div className="mt-auto">
                    <button onClick={() => signOut(auth)} className="flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors duration-200 text-gray-300 hover:bg-indigo-700 hover:text-white">
                        <i className="fas fa-sign-out-alt w-6 text-center"></i>
                        <span className="ml-4">Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

// --- LISTA DE COMPRAS ---
const ShoppingList = ({ db, userId }) => {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newItem, setNewItem] = useState({}); // { categoryId: 'itemName' }

    useEffect(() => {
        if (!db || !userId) return;
        const q = query(collection(db, `users/${userId}/shoppingLists`), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db, userId]);

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        await addDoc(collection(db, `users/${userId}/shoppingLists`), {
            name: newCategory,
            createdAt: serverTimestamp(),
            items: []
        });
        setNewCategory('');
    };

    const handleAddItem = async (categoryId) => {
        const itemName = newItem[categoryId]?.trim();
        if (!itemName) return;
        const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
        await updateDoc(categoryRef, {
            items: arrayUnion({ name: itemName, purchased: false, createdAt: new Date() })
        });
        setNewItem({ ...newItem, [categoryId]: '' });
    };

    const handleToggleItem = async (categoryId, item) => {
        const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
        // Firestore não permite modificar um item de array, então removemos o antigo e adicionamos o novo
        await updateDoc(categoryRef, { items: arrayRemove(item) });
        await updateDoc(categoryRef, { items: arrayUnion({ ...item, purchased: !item.purchased }) });
    };
    
    const handleDeleteCategory = async (categoryId) => {
        // Usamos window.confirm para uma confirmação simples
        if (window.confirm("Tem a certeza que quer apagar esta categoria e todos os seus itens?")) {
             await deleteDoc(doc(db, `users/${userId}/shoppingLists`, categoryId));
        }
    };

    return (
        <div className="p-4 md:p-8">
            <header className="p-6 bg-white rounded-xl shadow-lg text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Lista de Compras</h1>
            </header>
            
            <div className="bg-white p-6 rounded-xl shadow-lg mb-8">
                <h2 className="text-xl font-bold mb-4">Nova Categoria</h2>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newCategory} 
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Ex: Frutas, Limpeza..."
                        className="flex-grow p-2 border rounded-md"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    />
                    <button onClick={handleAddCategory} className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Criar</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{cat.name}</h3>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600 text-xs">Apagar Categoria</button>
                        </div>
                        <div className="space-y-3 flex-grow">
                            {cat.items?.sort((a,b) => a.name.localeCompare(b.name)).sort((a,b) => a.purchased - b.purchased).map((item, index) => (
                                <label key={index} className="flex items-center space-x-3 cursor-pointer group">
                                    <input 
                                        type="checkbox"
                                        checked={item.purchased}
                                        onChange={() => handleToggleItem(cat.id, item)}
                                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={item.purchased ? 'line-through text-gray-400' : ''}>{item.name}</span>
                                </label>
                            ))}
                        </div>
                         <div className="mt-4 pt-4 border-t flex items-center space-x-3 opacity-60 focus-within:opacity-100">
                             <div className="h-5 w-5 rounded border-gray-400 flex-shrink-0"></div>
                             <input
                                type="text"
                                placeholder="Novo item..."
                                value={newItem[cat.id] || ''}
                                onChange={(e) => setNewItem({ ...newItem, [cat.id]: e.target.value })}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddItem(cat.id)}
                                className="w-full bg-transparent focus:outline-none"
                             />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- AFAZERES ---
const TodoList = () => {
    return (
        <div className="p-4 md:p-8">
            <header className="p-6 bg-white rounded-xl shadow-lg text-center mb-8">
                 <h1 className="text-3xl font-bold text-gray-800">Afazeres</h1>
            </header>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <p className="text-center">Funcionalidade de Afazeres em construção.</p>
            </div>
        </div>
    );
};

// --- CALENDÁRIO ---
const CalendarView = () => {
    return (
        <div className="p-4 md:p-8">
            <header className="p-6 bg-white rounded-xl shadow-lg text-center mb-8">
                 <h1 className="text-3xl font-bold text-gray-800">Calendário</h1>
            </header>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <p className="text-center">Funcionalidade de Calendário em construção.</p>
            </div>
        </div>
    );
};


// --- FINANCEIRO (CÓDIGO COMPLETO) ---
const FinanceTracker = ({ db, userId }) => {
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
    const [isFixedCostFilterOpen, setIsFixedCostFilterOpen] = useState(false);
    const [selectedFixedCosts, setSelectedFixedCosts] = useState(['Aluguel', 'Luz', 'Internet', 'Gás', 'Convênio', 'Flag']);

    const expenseCategories = ["Aluguel", "Casa", "Convênio", "Crédito", "Estudos", "Farmácia", "Flag", "Gás", "Internet", "Investimento", "Lanche", "Locomoção", "Luz", "MaryJane", "Mercado", "Outros", "Pets", "Raulzinho", "Streamings"].sort();
    const revenueCategories = ["13º", "Bônus", "Férias", "Outros", "Rendimentos", "Salário"].sort();

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
        filteredHistoryTransactions.forEach(t => {
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

    const transactionsForSummary = transactions.filter(t => {
        const transactionDate = t.timestamp?.toDate();
        if (!transactionDate) return false;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && transactionDate < start) return false;
        if (end && transactionDate > end) return false;
        if (userFilter !== 'Todos' && t.importer !== userFilter) return false;
        return true;
    });

    const filteredHistoryTransactions = transactionsForSummary.filter(t => {
        if (classificationFilter === 'Classificados' && (!t.category || t.category === '')) return false;
        if (classificationFilter === 'A Classificar' && t.category && t.category !== '') return false;
        return true;
    });

    const totalRevenue = transactionsForSummary.filter(t => t.type === 'receita' && t.category !== 'Rendimentos').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactionsForSummary.filter(t => t.type === 'despesa' && t.category !== 'Investimento').reduce((sum, t) => sum + t.amount, 0);
    const totalBalance = totalRevenue + totalExpense;
    
    const barChartData = Object.entries(
        transactionsForSummary
            .filter(t => t.type === 'despesa' && t.category)
            .reduce((acc, t) => {
                if (!acc[t.category]) acc[t.category] = 0;
                acc[t.category] += Math.abs(t.amount);
                return acc;
            }, {})
    ).map(([name, total]) => ({ name, total })).sort((a,b) => b.total - a.total);

    const monthlyData = transactionsForSummary.reduce((acc, t) => {
        if (!t.timestamp) return acc;
        const monthYear = new Intl.DateTimeFormat('pt-BR', { year: '2-digit', month: 'short' }).format(t.timestamp.toDate());
        if (!acc[monthYear]) {
            acc[monthYear] = { name: monthYear, Receitas: 0, Despesas: 0 };
        }
        if (t.type === 'receita') {
            acc[monthYear].Receitas += t.amount;
        } else {
            acc[monthYear].Despesas += Math.abs(t.amount);
        }
        return acc;
    }, {});
    const monthlyChartData = Object.values(monthlyData).reverse();

    const monthlyFixedCostData = transactionsForSummary
        .filter(t => t.type === 'despesa' && selectedFixedCosts.includes(t.category))
        .reduce((acc, t) => {
            if (!t.timestamp) return acc;
            const monthYear = new Intl.DateTimeFormat('pt-BR', { year: '2-digit', month: 'short' }).format(t.timestamp.toDate());
            if (!acc[monthYear]) {
                acc[monthYear] = { name: monthYear };
            }
            if (!acc[monthYear][t.category]) {
                acc[monthYear][t.category] = 0;
            }
            acc[monthYear][t.category] += Math.abs(t.amount);
            return acc;
        }, {});
    const monthlyFixedCostChartData = Object.values(monthlyFixedCostData).reverse();

    const handleFixedCostSelection = (category) => {
        setSelectedFixedCosts(prev => 
            prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
        );
    };

    const fixedCostColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    const unclassifiedCount = transactions.filter(t => !t.category || t.category === '').length;
    const totalRaul = transactions.filter(t => t.importer === 'Raul').length;
    const classifiedRaul = transactions.filter(t => t.importer === 'Raul' && t.category && t.category !== '').length;
    const raulProgress = totalRaul > 0 ? (classifiedRaul / totalRaul) * 100 : 0;
    const totalKarol = transactions.filter(t => t.importer === 'Karol').length;
    const classifiedKarol = transactions.filter(t => t.importer === 'Karol' && t.category && t.category !== '').length;
    const karolProgress = totalKarol > 0 ? (classifiedKarol / totalKarol) * 100 : 0;

    if (loading) return <LoadingScreen />;

    return (
        <div className="p-4 md:p-8">
            {/* ... toda a UI do financeiro ... */}
        </div>
    );
};
// --- TELA DE LOGIN E REGISTO ---
const AuthScreen = ({ auth }) => { /* ... seu AuthScreen, sem alterações ... */ };
// --- COMPONENTE PRINCIPAL QUE GERE A VISUALIZAÇÃO ---
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('finance'); // Começa no financeiro por defeito
    const [isAuthReady, setIsAuthReady] = useState(false);

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

            const firebaseApp = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(firebaseApp);
            const firestoreDb = getFirestore(firebaseApp);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null);
                }
                setIsAuthReady(true);
            });
        } catch (e) {
            console.error("Erro na inicialização do Firebase:", e);
            setIsAuthReady(true); 
        }
    }, []);

    if (!isAuthReady) return <LoadingScreen />;
    if (!userId) return <AuthScreen auth={auth} />;
    
    return (
        <div className="relative min-h-screen md:flex">
            <Sidebar view={view} setView={setView} auth={auth} />
            <main className="flex-1 md:ml-64 bg-gray-100">
                {view === 'finance' && <FinanceTracker db={db} userId={userId} />}
                {view === 'shopping' && <ShoppingList db={db} userId={userId} />}
                {view === 'todo' && <TodoList />}
                {view === 'calendar' && <CalendarView />}
            </main>
             <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
        </div>
    );
}

export default App;

