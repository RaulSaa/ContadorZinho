<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erro de Build - ContadorZinho</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .fade-in {
            animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .code-block {
            font-family: 'Fira Code', monospace;
            background-color: #2D2D2D;
            color: #F8F8F2;
            border-radius: 5px;
            padding: 15px;
            overflow-x: auto;
            position: relative;
        }
        .copy-btn {
            transition: all 0.2s ease;
            position: absolute;
            top: 10px;
            right: 10px;
        }
        .line-number {
            color: #6A9955;
            margin-right: 15px;
            user-select: none;
        }
        .error-line {
            background-color: #FF000020;
            border-left: 3px solid #FF0000;
        }
        .tab {
            margin-left: 20px;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-4xl w-full bg-white rounded-xl shadow-lg overflow-hidden fade-in">
        <div class="md:flex">
            <div class="md:w-2/5 bg-gradient-to-b from-red-500 to-red-600 p-8 text-white flex flex-col justify-center">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
                    <h1 class="text-3xl font-bold mb-2">Erro de Build</h1>
                    <p class="opacity-90">Problema no processo de construção no Vercel</p>
                </div>
                <div class="mt-10">
                    <div class="bg-red-700 bg-opacity-40 p-4 rounded-lg">
                        <h2 class="font-bold text-lg mb-2"><i class="fas fa-lightbulb mr-2"></i>Erro Detectado</h2>
                        <p class="text-sm">Transform failed with 1 error:<br>/vercel/path0/app/src/App.jsx:1:1: ERROR: Expected identifier but found "!"</p>
                    </div>
                </div>
            </div>
            
            <div class="md:w-3/5 p-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-6">Como resolver este erro</h2>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-700 mb-2 flex items-center">
                        <i class="fas fa-bug mr-2 text-red-500"></i>Problema no arquivo App.jsx
                    </h3>
                    <p class="text-gray-600 mb-3">Seu arquivo App.jsx provavelmente contém um caractere inválido na primeira linha. Isso pode ser causado por:</p>
                    <ul class="list-disc list-inside text-gray-600 mb-4 tab">
                        <li>Caractere BOM (Byte Order Mark) no início do arquivo</li>
                        <li>Caractere especial ou invisível</li>
                        <li>Falta de uma importação ou declaração no início</li>
                    </ul>
                    
                    <h3 class="text-lg font-semibold text-gray-700 mb-2 flex items-center mt-4">
                        <i class="fas fa-wrench mr-2 text-red-500"></i>Solução
                    </h3>
                    <p class="text-gray-600 mb-3">Abra o arquivo App.jsx e certifique-se de que ele começa com a declaração de importação do React:</p>
                    
                    <div class="code-block mb-4">
                        <button class="copy-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">
                            <i class="fas fa-copy mr-1"></i> Copiar
                        </button>
                        <pre><code><span class="line-number">1</span>import React, { useState, useEffect } from 'react';</code></pre>
                    </div>
                    
                    <p class="text-gray-600 mb-3">Verifique também se não há caracteres inválidos antes da primeira linha.</p>
                    
                    <h3 class="text-lg font-semibold text-gray-700 mb-2 flex items-center mt-4">
                        <i class="fas fa-code mr-2 text-red-500"></i>App.jsx corrigido
                    </h3>
                    <p class="text-gray-600 mb-3">Seu arquivo App.jsx deve ser semelhante a este:</p>
                    
                    <div class="code-block mb-4" style="max-height: 300px; overflow-y: auto;">
                        <button class="copy-btn bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm">
                            <i class="fas fa-copy mr-1"></i> Copiar
                        </button>
                        <pre><code><span class="line-number">1</span>import React, { useState, useEffect } from 'react';
<span class="line-number">2</span>import { initializeApp } from 'firebase/app';
<span class="line-number">3</span>import { 
<span class="line-number">4</span>  getAuth, 
<span class="line-number">5</span>  onAuthStateChanged,
<span class="line-number">6</span>  createUserWithEmailAndPassword,
<span class="line-number">7</span>  signInWithEmailAndPassword,
<span class="line-number">8</span>  signOut
<span class="line-number">9</span>} from 'firebase/auth';
<span class="line-number">10</span>import { getFirestore, collection, onSnapshot, addDoc, query } from 'firebase/firestore';
<span class="line-number">11</span>
<span class="line-number">12</span>// Configuração do Firebase
<span class="line-number">13</span>const firebaseConfig = {
<span class="line-number">14</span>  apiKey: "AIzaSyBv0WRGvYlmBotnBc2InD85N1teQf45V2g",
<span class="line-number">15</span>  authDomain: "casinha-kr.firebaseapp.com",
<span class="line-number">16</span>  projectId: "casinha-kr",
<span class="line-number">17</span>  storageBucket: "casinha-kr.firebasestorage.app",
<span class="line-number">18</span>  messagingSenderId: "311939192764",
<span class="line-number">19</span>  appId: "1:311939192764:web:6a14910e5c35c4391a3db9",
<span class="line-number">20</span>  measurementId: "G-EDMYBHR1TY"
<span class="line-number">21</span>};
<span class="line-number">22</span>
<span class="line-number">23</span>// Inicialize o Firebase
<span class="line-number">24</span>const app = initializeApp(firebaseConfig);
<span class="line-number">25</span>const auth = getAuth(app);
<span class="line-number">26</span>const db = getFirestore(app);
<span class="line-number">27</span>
<span class="line-number">28</span>// Restante do seu código...</code></pre>
                    </div>
                </div>
                
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-exclamation-circle text-yellow-400"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-yellow-700">
                                <strong>Importante:</strong> Se você estiver usando um editor de texto como Notepad++, Sublime Text ou VS Code, 
                                verifique a codificação do arquivo (deve ser UTF-8 sem BOM) e certifique-se de que não há caracteres invisíveis 
                                no início do arquivo.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center mt-8">
                    <a href="#" class="text-blue-600 hover:text-blue-800 flex items-center">
                        <i class="fas fa-arrow-left mr-2"></i> Voltar para o login
                    </a>
                    <button class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center">
                        <i class="fas fa-sync-alt mr-2"></i> Tentar novamente
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Funcionalidade para copiar o bloco de código
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const codeBlock = this.parentElement.querySelector('code');
                const code = codeBlock.innerText;
                
                // Remove line numbers
                const codeWithoutLineNumbers = code.replace(/\d+\s/g, '');
                
                navigator.clipboard.writeText(codeWithoutLineNumbers).then(() => {
                    const originalHtml = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check mr-1"></i> Copiado!';
                    setTimeout(() => {
                        this.innerHTML = originalHtml;
                    }, 2000);
                });
            });
        });
        
        // Simular tentativa novamente
        document.querySelector('.bg-red-600').addEventListener('click', function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Verificando...';
            setTimeout(() => {
                this.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Erro ainda persiste';
                setTimeout(() => {
                    this.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Tentar novamente';
                }, 2000);
            }, 1500);
        });
    </script>
</body>
</html>
