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
const ShoppingList = ({ db, userId }) => { /* ... Código da Lista de Compras ... */ };

// --- AFAZERES ---
const TodoList = () => { /* ... placeholder ... */ };

// --- CALENDÁRIO ---
const CalendarView = ({ db, userId }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    
    // Formulário do evento
    const [eventTitle, setEventTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('10:00');
    const [frequency, setFrequency] = useState('none');
    const [reminder, setReminder] = useState('none');

    const holidays = { /* Feriados */ };

    // Pedir permissão para notificações
    useEffect(() => {
        if ("Notification" in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if(permission === 'granted') {
                    console.log("Permissão para notificações concedida!");
                }
            });
        }
    }, []);

    useEffect(() => {
        if (!db || !userId) return;
        const q = query(collection(db, `users/${userId}/calendarEvents`));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db, userId]);

    const openCreateModal = () => {
        setEditingEvent(null);
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
        setEventTitle('');
        setStartTime('09:00');
        setEndTime('10:00');
        setFrequency('none');
        setReminder('none');
        setIsEventModalOpen(true);
    };

    const openEditModal = (event) => {
        setEditingEvent(event);
        setEventTitle(event.title);

        const start = new Date(event.start.seconds * 1000);
        setStartDate(start.toISOString().split('T')[0]);
        setStartTime(start.toTimeString().substring(0,5));

        if (event.end) {
            const end = new Date(event.end.seconds * 1000);
            setEndDate(end.toISOString().split('T')[0]);
            setEndTime(end.toTimeString().substring(0,5));
        } else {
            setEndDate('');
            setEndTime('');
        }
        setFrequency(event.frequency || 'none');
        setReminder(event.reminder || 'none');
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = async () => {
        if (!eventTitle || !startDate || !startTime) {
            alert("Por favor, preencha o título, a data e a hora de início.");
            return;
        }
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = endDate && endTime ? new Date(`${endDate}T${endTime}`) : null;
        
        const eventData = { title: eventTitle, start: startDateTime, end: endDateTime, frequency, reminder };

        if (editingEvent) {
            await setDoc(doc(db, `users/${userId}/calendarEvents`, editingEvent.id), eventData, { merge: true });
        } else {
            await addDoc(collection(db, `users/${userId}/calendarEvents`), { ...eventData, createdAt: serverTimestamp() });
        }
        setIsEventModalOpen(false);
    };

    const handleDeleteEvent = async () => {
        if (editingEvent && window.confirm("Tem a certeza que quer apagar este evento?")) {
            await deleteDoc(doc(db, `users/${userId}/calendarEvents`, editingEvent.id));
            setIsEventModalOpen(false);
        }
    };

    const changeDate = (amount) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };

    const getDaysForMonth = () => { /* ... Lógica do calendário ... */ return []; };
    const selectedDayEvents = selectedDate ? events.filter(e => new Date(e.start.seconds * 1000).toDateString() === selectedDate.toDateString()) : [];
    
    return (
        <div className="p-4 md:p-8">
            {isEventModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-4">
                        <h2 className="text-2xl font-bold">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h2>
                        <input type="text" placeholder="Título do evento" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="w-full p-2 border rounded-md"/>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm">Início</label>
                                <div className="flex gap-2">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-md"/>
                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded-md"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm">Fim (opcional)</label>
                                <div className="flex gap-2">
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-md"/>
                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded-md"/>
                                </div>
                            </div>
                        </div>
                        <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full p-2 border rounded-md">
                            <option value="none">Não se repete</option>
                            <option value="daily">Diariamente</option>
                            <option value="weekly">Semanalmente</option>
                            <option value="monthly">Mensalmente</option>
                        </select>
                         <select value={reminder} onChange={e => setReminder(e.target.value)} className="w-full p-2 border rounded-md">
                            <option value="none">Nenhum aviso</option>
                            <option value="15m">15 minutos antes</option>
                            <option value="1h">1 hora antes</option>
                            <option value="1d">1 dia antes</option>
                        </select>
                        <div className="flex justify-between items-center">
                            {editingEvent && (
                                <button onClick={handleDeleteEvent} className="py-2 px-4 rounded-md text-white bg-red-600 hover:bg-red-700">Apagar</button>
                            )}
                            <div className="flex-grow flex justify-end gap-4">
                                <button onClick={() => setIsEventModalOpen(false)} className="py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300">Cancelar</button>
                                <button onClick={handleSaveEvent} className="py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700">{editingEvent ? 'Salvar' : 'Criar'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <header className="p-6 bg-white rounded-xl shadow-lg text-center mb-8">
                 <div className="flex justify-between items-center">
                    <button onClick={() => changeDate(-1)} className="p-2 rounded-full hover:bg-gray-200"><i className="fas fa-chevron-left"></i></button>
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate)}</h1>
                    <button onClick={() => changeDate(1)} className="p-2 rounded-full hover:bg-gray-200"><i className="fas fa-chevron-right"></i></button>
                 </div>
            </header>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-600 mb-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {getDaysForMonth().map(dayInfo => (
                        <div key={dayInfo.key} 
                             onClick={() => !dayInfo.isEmpty && setSelectedDate(dayInfo.date)}
                             className={`p-2 h-24 text-center border rounded-lg cursor-pointer transition-colors
                                ${dayInfo.isEmpty ? 'bg-gray-50' : 'hover:bg-gray-100'}
                                ${dayInfo.isToday ? 'bg-indigo-100 font-bold' : ''}
                                ${dayInfo.holiday?.type === 'national' ? 'bg-red-100' : ''}
                                ${dayInfo.holiday?.type === 'local' ? 'bg-yellow-100' : ''}
                                ${selectedDate?.toDateString() === dayInfo.date?.toDateString() ? 'ring-2 ring-indigo-500' : ''}`}>
                            <span className="text-sm">{dayInfo.day}</span>
                            {dayInfo.hasEvents && <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-blue-500"></div>}
                            {dayInfo.holiday && <div className="mt-1 text-xs truncate" title={dayInfo.holiday.name}>{dayInfo.holiday.name}</div>}
                        </div>
                    ))}
                </div>
            </div>
            {selectedDate && (
                <div className="mt-8 bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold mb-4">Eventos para {selectedDate.toLocaleDateString('pt-BR')}</h2>
                    {selectedDayEvents.length > 0 ? (
                        <ul className="space-y-3">
                            {selectedDayEvents.map(event => (
                                <li key={event.id} onClick={() => openEditModal(event)} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                                    <p className="font-semibold">{event.title}</p>
                                    <p className="text-sm text-gray-600">
                                        {new Date(event.start.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Nenhum evento para este dia.</p>
                    )}
                </div>
            )}
            <button onClick={openCreateModal} className="fixed bottom-6 right-6 h-16 w-16 flex items-center justify-center rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700">
                <i className="fas fa-plus text-2xl"></i>
            </button>
        </div>
    );
};


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
                {view === 'calendar' && <CalendarView db={db} userId={userId} />}
            </main>
             <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
        </div>
    );
}

export default App;

