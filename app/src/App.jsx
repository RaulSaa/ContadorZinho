import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, query, serverTimestamp, updateDoc, arrayUnion, arrayRemove, orderBy, writeBatch } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// --- FUNÇÕES AUXILIARES DE DATA (MOVIDAS PARA CIMA PARA CORRIGIR O ERRO) ---
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getPreviousMonthRange = () => {
  const today = new Date();
  const endOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfPreviousMonth = new Date(endOfPreviousMonth.getFullYear(), endOfPreviousMonth.getMonth(), 1);
  return {
    start: formatDate(startOfPreviousMonth),
    end: formatDate(endOfPreviousMonth),
  };
};

const getLastSixMonthsRange = () => {
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
};


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
    { name: "Missões", view: "todo", icon: "fas fa-check-square" },
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
  const [deleteMode, setDeleteMode] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState([]);
  const pressTimer = useRef();

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
    await addDoc(collection(db, `users/${userId}/shoppingLists`), { name: newCategoryInModal, createdAt: serverTimestamp(), items: [] });
    setNewCategoryInModal('');
  };

  const handleAddItem = async (categoryId) => {
    const itemName = newItem[categoryId]?.trim();
    if (!itemName) return;
    const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
    await updateDoc(categoryRef, { items: arrayUnion({ name: itemName, purchased: false }) });
    setNewItem({ ...newItem, [categoryId]: '' });
  };

  const handleToggleItemPurchased = async (categoryId, item) => {
    const categoryRef = doc(db, `users/${userId}/shoppingLists`, categoryId);
    await updateDoc(categoryRef, { items: arrayRemove(item) });
    await updateDoc(categoryRef, { items: arrayUnion({ ...item, purchased: !item.purchased }) });
  };

  const handleItemInteraction = (categoryId, item) => {
    if (deleteMode) {
      setItemsToDelete(prev => {
        const isSelected = prev.some(i => i.name === item.name && i.categoryId === categoryId);
        if (isSelected) {
          return prev.filter(i => !(i.name === item.name && i.categoryId === categoryId));
        } else {
          return [...prev, { ...item, categoryId }];
        }
      });
    } else {
      handleToggleItemPurchased(categoryId, item);
    }
  };

  const handlePressStart = (categoryId, item) => {
    pressTimer.current = setTimeout(() => {
      setDeleteMode(true);
      setItemsToDelete([{ ...item, categoryId }]);
    }, 700);
  };

  const handlePressEnd = () => {
    clearTimeout(pressTimer.current);
  };

  const handleDeleteSelectedItems = async () => {
    if (itemsToDelete.length === 0) return;
    if (window.confirm(`Tem a certeza que quer apagar ${itemsToDelete.length} item(ns)?`)) {
      const batch = writeBatch(db);
      const updates = {};
      itemsToDelete.forEach(item => {
        if (!updates[item.categoryId]) {
          const category = categories.find(c => c.id === item.categoryId);
          updates[item.categoryId] = {
            ref: doc(db, `users/${userId}/shoppingLists`, item.categoryId),
            items: category.items || []
          };
        }
      });
      Object.values(updates).forEach(update => {
        const itemsToRemoveInCategory = itemsToDelete.filter(i => i.categoryId === update.ref.id);
        const newItems = update.items.filter(item => !itemsToRemoveInCategory.some(toDelete => toDelete.name === item.name));
        batch.update(update.ref, { items: newItems });
      });

      await batch.commit();
      setDeleteMode(false);
      setItemsToDelete([]);
    }
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

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <div className="p-4 md:p-8">
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-6">
            <h2 className="text-2xl font-bold">Editar Categorias</h2>
            <div>
              <h3 className="text-lg font-semibold mb-2">Criar Nova Categoria</h3>
              <div className="flex gap-2">
                <input type="text" value={newCategoryInModal} onChange={(e) => setNewCategoryInModal(e.target.value)} placeholder="Nome da categoria" className="flex-grow p-2 border rounded-md" />
                <button onClick={handleAddCategory} className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Criar</button>
              </div>
            </div>
            {categories.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Apagar Categorias</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded-md">
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center space-x-3 p-1 rounded hover:bg-gray-100">
                      <input type="checkbox" checked={categoriesToDelete.includes(cat.id)} onChange={() => handleToggleDeleteCategory(cat.id)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
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
        {categories.map(cat => {
          const isCollapsed = collapsedCategories.includes(cat.id);
          return (
            <div key={cat.id} className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{cat.name}</h3>
                <button onClick={() => toggleCategoryCollapse(cat.id)} className="text-gray-400 hover:text-gray-700">
                  <i className={`fas ${isCollapsed ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {!isCollapsed && (
                <>
                  <div className="space-y-3 flex-grow">
                    {cat.items?.sort((a, b) => a.purchased - b.purchased || a.name.localeCompare(b.name)).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 group cursor-pointer"
                        onClick={() => handleItemInteraction(cat.id, item)}
                        onTouchStart={() => handlePressStart(cat.id, item)}
                        onTouchEnd={handlePressEnd}
                        onMouseDown={() => handlePressStart(cat.id, item)}
                        onMouseUp={handlePressEnd}
                      >
                        {!deleteMode ? (
                          <input type="checkbox" readOnly checked={item.purchased} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 pointer-events-none" />
                        ) : (
                          <input type="checkbox" readOnly checked={itemsToDelete.some(i => i.name === item.name && i.categoryId === cat.id)} className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500 pointer-events-none" />
                        )}
                        <span className={`flex-grow ${item.purchased && !deleteMode ? 'line-through text-gray-400' : ''}`}>{item.name}</span>
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
                </>
              )}
            </div>
          )
        })}
      </div>
      {deleteMode && (
        <div className="fixed bottom-6 right-6 flex flex-col items-center gap-2">
          <button onClick={() => { setDeleteMode(false); setItemsToDelete([]); }} className="h-12 w-12 flex items-center justify-center rounded-full bg-gray-500 text-white shadow-lg hover:bg-gray-600">
            <i className="fas fa-times"></i>
          </button>
          <button onClick={handleDeleteSelectedItems} className="h-16 w-16 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 disabled:opacity-50" disabled={itemsToDelete.length === 0}>
            <i className="fas fa-trash-alt text-xl"></i>
          </button>
        </div>
      )}
    </div>
  );
};

// --- MISSÕES ---
const TodoList = ({ db, userId }) => {
  const [todos, setTodos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTodo, setCurrentTodo] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    responsible: '',
    dueDate: '',
    steps: [],
    observations: ''
  });
  const [newStepText, setNewStepText] = useState('');

  useEffect(() => {
    if (!db || !userId) return;
    const q = query(collection(db, `users/${userId}/todos`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTodos(todosData);
    });
    return () => unsubscribe();
  }, [db, userId]);

  const handleOpenCreateModal = () => {
    setCurrentTodo(null);
    setFormData({ title: '', responsible: '', dueDate: '', steps: [], observations: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (todo) => {
    setCurrentTodo(todo);
    setFormData({
      title: todo.title || '',
      responsible: todo.responsible || '',
      dueDate: todo.dueDate ? new Date(todo.dueDate.seconds * 1000).toISOString().split('T')[0] : '',
      steps: todo.steps || [],
      observations: todo.observations || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentTodo(null);
  };

  const handleSaveTodo = async () => {
    if (!formData.title.trim()) {
      alert('O título é obrigatório.');
      return;
    }

    const dataToSave = {
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
    };

    try {
      if (currentTodo) {
        const todoRef = doc(db, `users/${userId}/todos`, currentTodo.id);
        await updateDoc(todoRef, dataToSave);
      } else {
        await addDoc(collection(db, `users/${userId}/todos`), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Erro ao salvar a missão:", error);
      alert("Ocorreu um erro ao salvar a missão. Verifique as regras de segurança do Firestore no console do Firebase.");
    }
  };

  const handleDeleteTodo = async () => {
    if (currentTodo && window.confirm("Tem a certeza que quer apagar esta missão?")) {
      await deleteDoc(doc(db, `users/${userId}/todos`, currentTodo.id));
      handleCloseModal();
    }
  };

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    const newStep = { name: newStepText, completed: false };
    setFormData(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    setNewStepText('');
  };

  const handleToggleStep = (indexToToggle) => {
    const updatedSteps = formData.steps.map((step, index) =>
      index === indexToToggle ? { ...step, completed: !step.completed } : step
    );
    setFormData(prev => ({ ...prev, steps: updatedSteps }));
  };

  const handleDeleteStep = (indexToDelete) => {
    const updatedSteps = formData.steps.filter((_, index) => index !== indexToDelete);
    setFormData(prev => ({ ...prev, steps: updatedSteps }));
  }

  return (
    <div className="p-4 md:p-8">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold">{currentTodo ? 'Editar Missão' : 'Nova Missão'}</h2>
            <input type="text" placeholder="Título da missão..." value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full p-2 border rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={formData.responsible} onChange={e => setFormData({ ...formData, responsible: e.target.value })} className="w-full p-2 border rounded-md">
                <option value="">Sem responsável</option>
                <option value="Karol">Karol</option>
                <option value="Raul">Raul</option>
              </select>
              <input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="w-full p-2 border rounded-md" />
            </div>

            {currentTodo && (
              <div className="space-y-2 pt-4 border-t">
                <h3 className="text-lg font-semibold">Etapas</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="Nova etapa..." value={newStepText} onChange={e => setNewStepText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddStep} className="flex-grow p-2 border rounded-md" />
                  <button onClick={handleAddStep} className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Adicionar</button>
                </div>
                <div className="space-y-1">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3 p-1 group">
                      <input type="checkbox" checked={step.completed} onChange={() => handleToggleStep(index)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className={`flex-grow ${step.completed ? 'line-through text-gray-400' : ''}`}>{step.name}</span>
                      <button onClick={() => handleDeleteStep(index)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentTodo && (
              <div className="space-y-2 pt-4 border-t">
                <h3 className="text-lg font-semibold">Observações</h3>
                <textarea placeholder="Adicione notas aqui..." value={formData.observations} onChange={e => setFormData({ ...formData, observations: e.target.value })} className="w-full p-2 border rounded-md h-24"></textarea>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              {currentTodo ? (
                <button onClick={handleDeleteTodo} className="py-2 px-4 rounded-md text-white bg-red-600 hover:bg-red-700">Apagar</button>
              ) : <div></div>}
              <div className="flex justify-end gap-4">
                <button onClick={handleCloseModal} className="py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300">Cancelar</button>
                <button onClick={handleSaveTodo} className="py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700">{currentTodo ? 'Salvar' : 'Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="p-6 bg-white rounded-xl shadow-lg flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Missões</h1>
        <button onClick={handleOpenCreateModal} className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
          <i className="fas fa-plus mr-2"></i>Criar Nova Missão
        </button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {todos.map(todo => (
          <div key={todo.id} onClick={() => handleOpenEditModal(todo)} className="bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow space-y-3">
            <h3 className="font-bold text-lg text-gray-800">{todo.title}</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {todo.responsible && (
                <span className={`px-2 py-1 rounded-full text-white ${todo.responsible === 'Raul' ? 'bg-blue-400' : 'bg-purple-600'}`}>
                  <i className="fas fa-user mr-1"></i>{todo.responsible}
                </span>
              )}
              {todo.dueDate && (
                <span className="px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                  <i className="fas fa-calendar-alt mr-1"></i>{new Date(todo.dueDate.seconds * 1000).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- CALENDÁRIO ---
const CalendarView = ({ db, userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [frequency, setFrequency] = useState('none');
  const [reminder, setReminder] = useState('none');
  const holidays = { '01-01': { name: 'Confraternização Universal', type: 'national' },'01-25': { name: 'Aniversário de São Paulo', type: 'local' },'03-04': { name: 'Carnaval', type: 'national' },'04-18': { name: 'Paixão de Cristo', type: 'national' },'04-21': { name: 'Tiradentes', type: 'national' },'05-01': { name: 'Dia do Trabalho', type: 'national' },'06-19': { name: 'Corpus Christi', type: 'national' },'07-09': { name: 'Revolução Constitucionalista', type: 'local' },'09-07': { name: 'Independência do Brasil', type: 'national' },'10-12': { name: 'Nossa Senhora Aparecida', type: 'national' },'11-02': { name: 'Finados', type: 'national' },'11-15': { name: 'Proclamação da República', type: 'national' },'11-20': { name: 'Consciência Negra', type: 'local' },'12-25': { name: 'Natal', type: 'national' }, };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission();
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
    setStartDate(today); setEndDate(today); setEventTitle('');
    setStartTime('09:00'); setEndTime('10:00'); setFrequency('none'); setReminder('none');
    setIsEventModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    const start = new Date(event.start.seconds * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setStartTime(start.toTimeString().substring(0, 5));
    if (event.end) {
      const end = new Date(event.end.seconds * 1000);
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().substring(0, 5));
    } else { setEndDate(''); setEndTime(''); }
    setFrequency(event.frequency || 'none');
    setReminder(event.reminder || 'none');
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventTitle || !startDate || !startTime) return;

    // Criar um novo objeto Date para a data e hora de início
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startDateTime = new Date(startYear, startMonth - 1, startDay, startHour, startMinute);

    let endDateTime = null;
    if (endDate && endTime) {
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      endDateTime = new Date(endYear, endMonth - 1, endDay, endHour, endMinute);
    }
    
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

  const getDaysForMonth = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    let days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push({ key: `empty-${i}`, isEmpty: true });
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const holiday = holidays[dateString];
      const dayEvents = events.filter(e => new Date(e.start.seconds * 1000).toDateString() === date.toDateString());
      days.push({ key: day, day, date, isToday: new Date().toDateString() === date.toDateString(), holiday, hasEvents: dayEvents.length > 0 });
    }
    return days;
  };

  const getSelectedDayEvents = () => {
    if (!selectedDate) return [];
    const userEvents = events.filter(e => new Date(e.start.seconds * 1000).toDateString() === selectedDate.toDateString()).map(e => ({ ...e, type: 'event' }));
    const dateString = `${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const holiday = holidays[dateString];
    return holiday ? [{ ...holiday, type: 'holiday' }, ...userEvents] : userEvents;
  };

  const selectedDayEvents = getSelectedDayEvents();

  return (
    <div className="p-4 md:p-8">
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg space-y-4">
            <h2 className="text-2xl font-bold">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h2>
            <input type="text" placeholder="Título do evento" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="w-full p-2 border rounded-md" />
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm">Início</label>
                <div className="flex gap-2 mt-1">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-md" />
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded-md" />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-sm">Fim (opcional)</label>
                <div className="flex gap-2 mt-1">
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-md" />
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded-md" />
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
              className={`p-2 h-24 text-center border rounded-lg cursor-pointer transition-colors relative
                ${dayInfo.isEmpty ? 'bg-gray-50' : 'hover:bg-gray-100'}
                ${dayInfo.isToday ? 'bg-indigo-100 font-bold' : ''}
                ${dayInfo.holiday ? 'bg-blue-100' : ''}
                ${dayInfo.hasEvents ? 'bg-yellow-100' : ''}
                ${selectedDate?.toDateString() === dayInfo.date?.toDateString() ? 'ring-2 ring-indigo-500' : ''}`}>
              <span className="text-sm">{dayInfo.day}</span>
              {dayInfo.hasEvents && dayInfo.holiday && <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-orange-500"></div>}
            </div>
          ))}
        </div>
      </div>
      {selectedDate && (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Eventos para {selectedDate.toLocaleDateString('pt-BR')}</h2>
          {selectedDayEvents.length > 0 ? (
            <ul className="space-y-3">
              {selectedDayEvents.map((event, index) => (
                <li key={index} onClick={() => event.type === 'event' && openEditModal(event)}
                  className={`p-3 rounded-lg flex items-center gap-3 ${event.type === 'event' ? 'bg-yellow-50 hover:bg-yellow-100 cursor-pointer' : 'bg-blue-50'}`}>
                  <i className={`fas ${event.type === 'holiday' ? 'fa-glass-cheers text-blue-500' : 'fa-clock text-yellow-600'}`}></i>
                  <div>
                    <p className="font-semibold">{event.title || event.name}</p>
                    {event.type === 'event' && (
                      <p className="text-sm text-gray-600">
                        {new Date(event.start.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
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

// --- FINANCEIRO ---
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
  const [activeTab, setActiveTab] = useState('lancamentos');
  const [isFixedCostFilterOpen, setIsFixedCostFilterOpen] = useState(false);
  const [selectedFixedCosts, setSelectedFixedCosts] = useState(['Aluguel', 'Luz', 'Internet', 'Gás', 'Convênio', 'Flag']);
  const expenseCategories = ["Aluguel", "Casa", "Convênio", "Crédito", "Estudos", "Farmácia", "Flag", "Gás", "Internet", "Investimento", "Lanche", "Locomoção", "Luz", "MaryJane", "Mercado", "Outros", "Pets", "Raulzinho", "Streamings"].sort();
  const revenueCategories = ["13º", "Bônus", "Férias", "Outros", "Rendimentos", "Salário"].sort();
  const [existingTransactionIds, setExistingTransactionIds] = useState(new Set());

  const [startDate, setStartDate] = useState(getPreviousMonthRange().start);
  const [endDate, setEndDate] = useState(getPreviousMonthRange().end);

  useEffect(() => {
    if (activeTab === 'lancamentos') {
      const { start, end } = getPreviousMonthRange();
      setStartDate(start);
      setEndDate(end);
    } else if (activeTab === 'graficos') {
      const { start, end } = getLastSixMonthsRange();
      setStartDate(start);
      setEndDate(end);
    }
  }, [activeTab]);

  const createTransactionId = (transaction) => {
    const datePart = new Date(transaction.timestamp).toISOString().split('T')[0];
    const descriptionPart = transaction.description.trim().toLowerCase();
    const amountPart = Number(transaction.amount).toFixed(2);
    const importerPart = transaction.importer || '';
    return `${datePart}_${descriptionPart}_${amountPart}_${importerPart}`;
  };

  const parseCsvText = (text, isClassified = false) => {
    const transactions = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');

    if (isClassified) {
      if (lines.length <= 1) return transactions;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(';');
        if (parts.length >= 6) {
          const dateString = parts[0].trim();
          const description = parts[1].trim();
          const type = parts[2].trim();
          const valueString = parts[3].replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.').trim();
          const category = parts[4].trim();
          const importer = parts[5].trim();
          const amount = parseFloat(valueString);
          if (!isNaN(amount)) {
            const [day, month, year] = dateString.split('/');
            const transactionDate = new Date(`${year}-${month}-${day}T12:00:00`);
            transactions.push({ timestamp: transactionDate, description, amount, type, category, importer });
          }
        }
      }
    } else {
        if (lines.length <= 3) return transactions;
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(';');
          if (parts.length >= 4) {
            const dateString = parts[0].trim();
            const description = parts[1].trim();
            const valueString = parts[3].replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.').trim();
            const amount = parseFloat(valueString);
            if (!isNaN(amount)) {
              const type = amount >= 0 ? 'receita' : 'despesa';
              const [day, month, year] = dateString.split('-');
              const transactionDate = new Date(`${year}-${month}-${day}T12:00:00`);
              transactions.push({ timestamp: transactionDate, description, amount, type });
            }
          }
        }
    }
    return transactions;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const parsedTransactions = parseCsvText(text, isClassifiedImport);
        if (parsedTransactions.length === 0) throw new Error("Nenhuma transação válida encontrada no arquivo.");
        
        let transactionsToAdd = [];
        let skippedCount = 0;
        parsedTransactions.forEach(transaction => {
          const transactionWithImporter = { ...transaction, importer: isClassifiedImport ? transaction.importer : importer };
          const uniqueId = createTransactionId(transactionWithImporter);
          if (!existingTransactionIds.has(uniqueId)) {
            transactionsToAdd.push(transactionWithImporter);
          } else {
            skippedCount++;
          }
        });
        
        if (transactionsToAdd.length === 0) {
          setParsingMessage({ message: `Nenhuma transação nova encontrada. ${skippedCount} duplicada(s) foram ignorada(s).`, type: 'success' });
          return;
        }

        const batch = writeBatch(db);
        transactionsToAdd.forEach(transaction => {
          const docRef = doc(collection(db, `users/${userId}/transactions`));
          batch.set(docRef, transaction);
        });
        await batch.commit();
        setParsingMessage({ message: `${transactionsToAdd.length} transações novas importadas. ${skippedCount} duplicada(s) foram ignorada(s).`, type: 'success' });
      } catch (error) {
        console.error("Erro ao processar o arquivo CSV:", error);
        setParsingMessage({ message: `Erro: ${error.message}`, type: 'error' });
      } finally {
        setIsParsing(false);
        event.target.value = null;
      }
    };
    reader.onerror = () => {
      setParsingMessage({ message: "Não foi possível ler o arquivo.", type: 'error' });
      setIsParsing(false);
    };
    reader.readAsText(file, 'UTF-8');
  };
  
  useEffect(() => {
    if (!db || !userId) return;
    const classificationsCollection = collection(db, `users/${userId}/classifications`);
    const unsubscribeClassifications = onSnapshot(classificationsCollection, (snapshot) => {
      const classifications = {};
      snapshot.forEach(doc => { classifications[doc.id] = doc.data().category; });
      setKnownClassifications(classifications);
    });
    const transactionsCollection = collection(db, `users/${userId}/transactions`);
    const unsubscribeTransactions = onSnapshot(query(transactionsCollection), (snapshot) => {
      const allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(allTransactions);
      const ids = new Set(allTransactions.map(t => createTransactionId({ ...t, timestamp: t.timestamp?.toDate() })));
      setExistingTransactionIds(ids);
      setLoading(false);
    });
    return () => {
      unsubscribeClassifications();
      unsubscribeTransactions();
    };
  }, [db, userId]);

  const addTransaction = (e, responsible) => {
    e.preventDefault();
    if (!description || !amount || !manualDate) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    const data = { description, amount: type === 'despesa' ? -Math.abs(parseFloat(amount)) : parseFloat(amount), type, importer: responsible, timestamp: new Date(manualDate + 'T12:00:00') };
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
    if (window.confirm("Tem a certeza que quer apagar esta transação?")) {
      await deleteDoc(doc(db, `users/${userId}/transactions`, transactionId));
      setParsingMessage({ message: "Transação apagada.", type: 'success' });
    }
  };

  const processedTransactions = transactions.map(t => ({
    ...t,
    category: t.category || knownClassifications[t.description] || null
  })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

  const transactionsForSummary = processedTransactions.filter(t => {
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
      .filter(t => t.type === 'despesa' && t.category && t.category !== 'Investimento')
      .reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = 0;
        acc[t.category] += Math.abs(t.amount);
        return acc;
      }, {})
  ).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  const monthlyData = transactionsForSummary.reduce((acc, t) => {
    if (!t.timestamp) return acc;
    const monthYear = new Intl.DateTimeFormat('pt-BR', { year: '2-digit', month: 'short' }).format(t.timestamp.toDate());
    if (!acc[monthYear]) {
      acc[monthYear] = { name: monthYear, Receitas: 0, Despesas: 0 };
    }
    if (t.type === 'receita' && t.category !== 'Rendimentos') {
      acc[monthYear].Receitas += t.amount;
    } else if (t.type === 'despesa' && t.category !== 'Investimento') {
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

  const totalInvestido = transactionsForSummary.filter(t => t.category === 'Investimento').reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalRendimentos = transactionsForSummary.filter(t => t.category === 'Rendimentos').reduce((sum, t) => sum + t.amount, 0);

  const handleFixedCostSelection = (category) => {
    setSelectedFixedCosts(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const fixedCostColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
  const unclassifiedCount = processedTransactions.filter(t => !t.category || t.category === '').length;
  const totalRaul = processedTransactions.filter(t => t.importer === 'Raul').length;
  const classifiedRaul = processedTransactions.filter(t => t.importer === 'Raul' && t.category && t.category !== '').length;
  const raulProgress = totalRaul > 0 ? (classifiedRaul / totalRaul) * 100 : 0;
  const totalKarol = processedTransactions.filter(t => t.importer === 'Karol').length;
  const classifiedKarol = processedTransactions.filter(t => t.importer === 'Karol' && t.category && t.category !== '').length;
  const karolProgress = totalKarol > 0 ? (classifiedKarol / totalKarol) * 100 : 0;

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 md:p-8">
      {isAddTransactionPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md space-y-4">
            <h2 className="text-2xl font-bold">Nova Transação</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              setIsResponsiblePopupOpen(true);
            }}>
              <div className="space-y-4">
                <input type="text" placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} required className="w-full p-2 border rounded-md" />
                <input type="number" step="0.01" placeholder="Valor" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full p-2 border rounded-md" />
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} required className="w-full p-2 border rounded-md" />
                <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded-md">
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsAddTransactionPopupOpen(false)} className="py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Próximo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResponsiblePopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-center">Quem é o responsável?</h2>
            <div className="flex justify-center gap-4">
              <button onClick={(e) => addTransaction(e, 'Karol')} className="py-3 px-6 rounded-md text-white bg-purple-600 hover:bg-purple-700">Karol</button>
              <button onClick={(e) => addTransaction(e, 'Raul')} className="py-3 px-6 rounded-md text-white bg-blue-400 hover:bg-blue-500">Raul</button>
            </div>
            <button onClick={() => setIsResponsiblePopupOpen(false)} className="w-full mt-4 py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300">Voltar</button>
          </div>
        </div>
      )}

      {isFixedCostFilterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold">Filtrar Custos Fixos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2">
              {expenseCategories.map(cat => (
                <label key={cat} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFixedCosts.includes(cat)}
                    onChange={() => handleFixedCostSelection(cat)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{cat}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setIsFixedCostFilterOpen(false)}
              className="mt-4 w-full py-2 px-4 rounded-md bg-gray-200 hover:bg-gray-300"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      <header className="p-6 bg-white rounded-xl shadow-lg text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">ContadorZinho</h1>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm font-medium">De:</label>
            <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md text-sm w-40" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm font-medium">Até:</label>
            <input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md text-sm w-40" />
          </div>
        </div>
      </header>
      <div className="space-y-8 mt-8">
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
                  <input type="checkbox" id="importClassified" checked={isClassifiedImport} onChange={(e) => setIsClassifiedImport(e.target.checked)} className="h-4 w-4 text-purple-600 border-gray-300 rounded" />
                  <label htmlFor="importClassified" className="text-sm text-gray-600">Importar ficheiro já classificado</label>
                </div>
                {!isClassifiedImport && (
                  <div className="flex gap-4">
                    <button onClick={() => setImporter('Raul')} className={`flex-1 py-2 px-4 rounded-md text-sm ${importer === 'Raul' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Raul</button>
                    <button onClick={() => setImporter('Karol')} className={`flex-1 py-2 px-4 rounded-md text-sm ${importer === 'Karol' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>Karol</button>
                  </div>
                )}
                <input
                  type="file"
                  ref={csvInputRef}
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => csvInputRef.current.click()}
                  disabled={isParsing || (!isClassifiedImport && !importer)}
                  className="w-full py-2 px-4 rounded-md text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsing ? 'A importar...' : 'Importar CSV'}
                </button>
              </div>
            </section>
            <section className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Histórico ({unclassifiedCount} por classificar)</h2>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setClassificationFilter('Todos')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'Todos' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}>Todas</button>
                <button onClick={() => setClassificationFilter('Classificados')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'Classificados' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Classificadas</button>
                <button onClick={() => setClassificationFilter('A Classificar')} className={`py-1 px-3 rounded-md text-xs ${classificationFilter === 'A Classificar' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>A Classificar</button>
              </div>
              {filteredHistoryTransactions.map(t => (
                <div key={t.id} className="py-4 flex justify-between items-center border-b">
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-sm text-gray-500">{t.timestamp?.toDate().toLocaleDateString('pt-BR')}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {t.importer && <span className={`text-xs font-semibold text-white px-2 py-1 rounded-full ${t.importer === 'Raul' ? 'bg-blue-400' : 'bg-purple-600'}`}>{t.importer}</span>}
                      <select value={t.category || ''} onChange={(e) => classifyTransaction(t.id, 'category', e.target.value)} className="text-xs rounded border-gray-300 p-1">
                        <option value="">Classificar</option>
                        {(t.type === 'receita' ? revenueCategories : expenseCategories).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                      </select>
                      <button onClick={() => deleteTransaction(t.id)} className="text-red-500 hover:text-red-700 text-xs p-1"><i className="fas fa-trash"></i></button>
                    </div>
                  </div>
                  <span className={`font-semibold ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</span>
                </div>
              ))}
            </section>
          </>
        )}
        {activeTab === 'graficos' && (
          <div className="space-y-8">
            <section className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                <h2 className="text-lg font-semibold text-gray-600">Investido</h2>
                <p className="mt-2 text-3xl font-bold text-indigo-600">{formatCurrency(totalInvestido)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                <h2 className="text-lg font-semibold text-gray-600">Retiradas</h2>
                <p className="mt-2 text-3xl font-bold text-teal-600">{formatCurrency(totalRendimentos)}</p>
              </div>
            </section>
            <section className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-center">Receita vs. Despesa Mensal</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="Receitas" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </section>
            <section className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex justify-center items-center mb-4 relative">
                <h2 className="text-2xl font-bold">Gastos Fixos Mensais</h2>
                <button onClick={() => setIsFixedCostFilterOpen(true)} className="absolute right-0 p-2 rounded-full text-indigo-600 hover:bg-indigo-100">
                  <i className="fas fa-filter"></i>
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyFixedCostChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  {selectedFixedCosts.map((cost, index) => (
                    <Line key={cost} type="monotone" dataKey={cost} name={cost} stroke={fixedCostColors[index % fixedCostColors.length]} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </section>
            <section className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-center">Total por Categoria</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis type="category" dataKey="name" width={120} interval={0} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total" fill="#8884d8" name="Total Gasto" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>
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
            <input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha</label>
            <input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm" />
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
        if (user) {
          setUserId(user.uid);
          if ("Notification" in window && firebaseConfig.apiKey) {
            const messaging = getMessaging(firebaseApp);
            const requestPermissionAndToken = async (currentUserId) => {
              try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
                  if (!vapidKey) return;
                  const currentToken = await getToken(messaging, { vapidKey });
                  if (currentToken) {
                    const tokenRef = doc(db, `users/${currentUserId}/fcmTokens`, currentToken);
                    await setDoc(tokenRef, { token: currentToken, createdAt: serverTimestamp() });
                  }
                }
              } catch (err) { console.error('Erro ao obter token.', err); }
            };
            requestPermissionAndToken(user.uid);
          }
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
        {view === 'todo' && <TodoList db={db} userId={userId} />}
        {view === 'calendar' && <CalendarView db={db} userId={userId} />}
      </main>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
    </div>
  );
}

export default App;
