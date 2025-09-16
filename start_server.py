import http.server
import socketserver

# --- Configurações ---
PORTA = 8000  # Você pode mudar para 9000, 8080, etc., se precisar
# ---------------------

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Para garantir que ele procure os arquivos a partir da pasta raiz
        super().__init__(*args, directory='.', **kwargs)

try:
    with socketserver.TCPServer(("", PORTA), Handler) as httpd:
        print(f"Servidor iniciado na porta {PORTA}")
        print(f"Abra seu navegador e acesse: http://localhost:{PORTA}/")
        print("Pressione Ctrl+C para parar o servidor.")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServidor parado.")
except OSError:
    print(f"\nErro: A porta {PORTA} já está em uso. Tente outra porta.")