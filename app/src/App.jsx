<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erro de Configuração - Firebase</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            width: 100%;
            background: white;
            border-radius: 15px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }
        
        .header {
            background: #ff6b6b;
            color: white;
            padding: 25px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
            display: flex;
            flex-wrap: wrap;
        }
        
        .problem, .solution {
            flex: 1;
            min-width: 300px;
            padding: 20px;
        }
        
        .problem {
            border-right: 1px solid #eee;
        }
        
        h2 {
            color: #5c6bc0;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }
        
        h2 i {
            margin-right: 10px;
        }
        
        .step {
            margin-bottom: 25px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #5c6bc0;
        }
        
        .step h3 {
            color: #5c6bc0;
            margin-bottom: 10px;
        }
        
        .code-block {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            overflow-x: auto;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .env-var {
            color: #a6e22e;
        }
        
        .env-value {
            color: #ae81ff;
        }
        
        .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        
        .actions {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
        }
        
        .btn {
            padding: 12px 25px;
            border-radius: 30px;
            border: none;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.3s ease;
        }
        
        .btn-primary {
            background: #5c6bc0;
            color: white;
        }
        
        .btn-primary:hover {
            background: #3f51b5;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(92, 107, 192, 0.4);
        }
        
        .btn-secondary {
            background: #f8f9fa;
            color: #495057;
            border: 1px solid #dee2e6;
        }
        
        .btn-secondary:hover {
            background: #e9ecef;
            transform: translateY(-2px);
        }
        
        .btn i {
            margin-right: 8px;
        }
        
        @media (max-width: 768px) {
            .problem, .solution {
                border-right: none;
                border-bottom: 1px solid #eee;
            }
            
            .content {
                flex-direction: column;
            }
        }
        
        .firebase-config {
            background: #ffecb3;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .firebase-config h4 {
            margin-bottom: 10px;
            color: #ff8f00;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-exclamation-triangle"></i> Erro de Configuração do Firebase</h1>
            <p>As variáveis de ambiente não estão configuradas corretamente no Vercel</p>
        </div>
        
        <div class="content">
            <div class="problem">
                <h2><i class="fas fa-bug"></i> O Problema</h2>
                
                <div class="step">
                    <h3>Variáveis de ambiente não encontradas</h3>
                    <p>Seu aplicativo React não consegue acessar as variáveis de ambiente necessárias para conectar com o Firebase.</p>
                </div>
                
                <div class="step">
                    <h3>Mensagem de erro no console</h3>
                    <div class="code-block">
                        <span style="color: #f92672">Chave do Firebase não foram carregadas.</span><br>
                        <span style="color: #f92672">Verifique as variáveis de ambiente na Vercel.</span>
                    </div>
                </div>
                
                <div class="step">
                    <h3>Configuração do Firebase necessária</h3>
                    <div class="firebase-config">
                        <h4>Seu firebaseConfig deve ser:</h4>
                        <pre>
const firebaseConfig = {
  apiKey: "AIzaSyBv0WRGvYlmBotnBc2InD85N1teQf45V2g",
  authDomain: "casinha-kr.firebaseapp.com",
  projectId: "casinha-kr",
  storageBucket: "casinha-kr.firebasestorage.app",
  messagingSenderId: "311939192764",
  appId: "1:311939192764:web:6a14910e5c35c4391a3db9",
  measurementId: "G-EDMYBHR1TY"
};</pre>
                    </div>
                </div>
            </div>
            
            <div class="solution">
                <h2><i class="fas fa-wrench"></i> A Solução</h2>
                
                <div class="step">
                    <h3>Passo 1: Acessar o painel do Vercel</h3>
                    <p>Entre no dashboard do Vercel e selecione seu projeto.</p>
                </div>
                
                <div class="step">
                    <h3>Passo 2: Configurar variáveis de ambiente</h3>
                    <p>Vá em <strong>Settings</strong> → <strong>Environment Variables</strong> e adicione:</p>
                    <div class="code-block">
                        <span class="env-var">VITE_FIREBASE_API_KEY</span>=<span class="env-value">AIzaSyBv0WRGvYlmBotnBc2InD85N1teQf45V2g</span><br>
                        <span class="env-var">VITE_FIREBASE_AUTH_DOMAIN</span>=<span class="env-value">casinha-kr.firebaseapp.com</span><br>
                        <span class="env-var">VITE_FIREBASE_PROJECT_ID</span>=<span class="env-value">casinha-kr</span><br>
                        <span class="env-var">VITE_FIREBASE_STORAGE_BUCKET</span>=<span class="env-value">casinha-kr.firebasestorage.app</span><br>
                        <span class="env-var">VITE_FIREBASE_MESSAGING_SENDER_ID</span>=<span class="env-value">311939192764</span><br>
                        <span class="env-var">VITE_FIREBASE_APP_ID</span>=<span class="env-value">1:311939192764:web:6a14910e5c35c4391a3db9</span><br>
                        <span class="env-var">VITE_FIREBASE_MEASUREMENT_ID</span>=<span class="env-value">G-EDMYBHR1TY</span>
                    </div>
                </div>
                
                <div class="step">
                    <h3>Passo 3: Verificar se não há aspas</h3>
                    <p>Certifique-se de que os valores das variáveis <strong>não</strong> estão entre aspas.</p>
                    <div class="note">
                        <p><strong>Importante:</strong> No Vercel, os valores das variáveis de ambiente devem ser inseridos sem aspas.</p>
                    </div>
                </div>
                
                <div class="step">
                    <h3>Passo 4: Refazer o deploy</h3>
                    <p>Após configurar as variáveis, faça um novo deploy do seu projeto no Vercel.</p>
                </div>
            </div>
        </div>
        
        <div class="actions">
            <button class="btn btn-primary" onclick="window.location.reload()">
                <i class="fas fa-sync-alt"></i> Tentar Novamente
            </button>
            <button class="btn btn-secondary" onclick="alert('No código real, isso levaria você de volta para a página de login')">
                <i class="fas fa-arrow-left"></i> Voltar para o Login
            </button>
        </div>
    </div>

    <script>
        // Simulação de funcionalidade de copiar as variáveis
        document.querySelectorAll('.code-block').forEach(block => {
            block.addEventListener('click', function() {
                const text = this.innerText;
                navigator.clipboard.writeText(text).then(() => {
                    const originalBorder = this.style.border;
                    this.style.border = '2px solid #4caf50';
                    setTimeout(() => {
                        this.style.border = originalBorder;
                    }, 1000);
                });
            });
        });
    </script>
</body>
</html>
