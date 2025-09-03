import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, query, serverTimestamp, updateDoc, arrayUnion, arrayRemove, orderBy, writeBatch } from 'firebase/firestore';
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
    const [newItem, setNewItem] = useState({});
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newCategoryInModal, setNewCategoryInModal] = useState('');
    const [categoriesToDelete, setCategoriesToDelete] = useState([]);

    useEffect(() => {
        if (!db || !userId) return;
        const q = query(collection(db, `users/${userId}/shoppingLists`), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db, userId]);

    const handleAddCategory = async () => {
        if (!newCategoryInModal.trim()) return;
        await addDoc(collection(db, `users/${userId}/shoppingLists`), {
            name: newCategoryInModal,
            createdAt: serverTimestamp(),
            items: []
        });
        setNewCategoryInModal('');
    };

    const handleAddItem = async (categoryId) => {
        const itemName = newItem[categoryId]?.trim();
        if (!itemName) return;
        const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
        await updateDoc(categoryRef, {
            items: arrayUnion({ name: itemName, purchased: false })
        });
        setNewItem({ ...newItem, [categoryId]: '' });
    };

    const handleToggleItem = async (categoryId, item) => {
        const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
        await updateDoc(categoryRef, { items: arrayRemove(item) });
        await updateDoc(categoryRef, { items: arrayUnion({ ...item, purchased: !item.purchased }) });
    };

    const handleReorderItem = async (categoryId, itemIndex, direction) => {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;

        const items = [...category.items];
        const item = items[itemIndex];
        const swapIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;

        if (swapIndex < 0 || swapIndex >= items.length) return;

        [items[itemIndex], items[swapIndex]] = [items[swapIndex], items[itemIndex]];

        const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
        await updateDoc(categoryRef, { items });
    };

    const handleToggleDeleteCategory = (categoryId) => {
        setCategoriesToDelete(prev => 
            prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
        );
    };

    const handleDeleteSelectedCategories = async () => {
        if (categoriesToDelete.length === 0) return;
        if (window.confirm(`Tem a certeza que quer apagar ${categoriesToDelete.length} categoria(s)?`)) {
            const batch = writeBatch(db);
            categoriesToDelete.forEach(categoryId => {
                batch.delete(doc(db, `users/${userId}/shoppingLists`, categoryId));
            });
            await batch.commit();
            setCategoriesToDelete([]);
            setIsEditModalOpen(false);
        }
    };

    return (
        <div className="p-4 md:p-8">
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-6">
                        <h2 className="text-2xl font-bold">Editar Categorias</h2>
                        {/* Criar Categoria */}
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Criar Nova Categoria</h3>
                            <div className="flex gap-2">
                                <input type="text" value={newCategoryInModal} onChange={(e) => setNewCategoryInModal(e.target.value)} placeholder="Nome da categoria" className="flex-grow p-2 border rounded-md"/>
                                <button onClick={handleAddCategory} className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Criar</button>
                            </div>
                        </div>
                        {/* Apagar Categorias */}
                        {categories.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Apagar Categorias</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                                    {categories.map(cat => (
                                        <label key={cat.id} className="flex items-center space-x-3 p-1 rounded hover:bg-gray-100">
                                            <input type="checkbox" checked={categoriesToDelete.includes(cat.id)} onChange={() => handleToggleDeleteCategory(cat.id)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"/>
                                            <span>{cat.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {categoriesToDelete.length > 0 && (
                                     <button onClick={handleDeleteSelectedCategories} className="mt-4 w-full py-2 px-4 rounded-md text-white bg-red-600 hover:bg-red-700">
                                        Apagar Selecionadas ({categoriesToDelete.length})
                                     </button>
                                )}
                            </div>
                        )}
                        <button onClick={() => setIsEditModalOpen(false)} className="mt-4 w-full py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300">Fechar</button>
                    </div>
                </div>
            )}
            <header className="p-6 bg-white rounded-xl shadow-lg flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Lista de Compras</h1>
                <button onClick={() => setIsEditModalOpen(true)} className="p-2 h-10 w-10 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600">
                    <i className="fas fa-cog text-xl"></i>
                </button>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(cat => (
                    <div key={cat.id} className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
                        <h3 className="text-xl font-bold mb-4">{cat.name}</h3>
                        <div className="space-y-3 flex-grow">
                            {cat.items?.sort((a,b) => a.purchased - b.purchased).map((item, index) => (
                                <div key={index} className="flex items-center space-x-3 group">
                                    <input type="checkbox" checked={item.purchased} onChange={() => handleToggleItem(cat.id, item)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"/>
                                    <span className={`flex-grow ${item.purchased ? 'line-through text-gray-400' : ''}`}>{item.name}</span>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleReorderItem(cat.id, index, 'up')} disabled={index === 0} className="px-2 text-gray-400 hover:text-gray-700 disabled:opacity-20"><i className="fas fa-arrow-up"></i></button>
                                        <button onClick={() => handleReorderItem(cat.id, index, 'down')} disabled={index === cat.items.length - 1} className="px-2 text-gray-400 hover:text-gray-700 disabled:opacity-20"><i className="fas fa-arrow-down"></i></button>
                                    </div>
                                </div>
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
                             {newItem[cat.id] && (
                                <button onClick={() => handleAddItem(cat.id)} className="text-green-500 hover:text-green-700 p-1">
                                    <i className="fas fa-check"></i>
                                </button>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- AFAZERES ---
const TodoList = () => { /* ... placeholder ... */ };

// --- CALENDÁRIO ---
const CalendarView = () => { /* ... placeholder ... */ };


// --- FINANCEIRO (CÓDIGO COMPLETO) ---
const FinanceTracker = ({ db, userId }) => {
    // ... Todo o seu código financeiro completo e inalterado vai aqui ...
};


// --- TELA DE LOGIN E REGISTO ---
const AuthScreen = ({ auth }) => { /* ... seu AuthScreen, sem alterações ... */ };


// --- COMPONENTE PRINCIPAL QUE GERE A VISUALIZAÇÃO ---
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('finance');
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
            
            if (!firebaseConfig.apiKey) console.error("Chaves do Firebase não foram carregadas.");

            const firebaseApp = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(firebaseApp);
            const firestoreDb = getFirestore(firebaseApp);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) setUserId(user.uid);
                else setUserId(null);
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

