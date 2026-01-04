use axum::{
    response::{Html, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;

const OAUTH_CALLBACK_PORT: u16 = 8080;

#[derive(Debug, Deserialize)]
struct TokenPayload {
    fragment: String,
}

#[derive(Debug, Serialize)]
struct TokenResponse {
    success: bool,
    message: String,
}

pub async fn start_oauth_flow(
    _app: tauri::AppHandle,
    oauth_url: String,
) -> Result<String, String> {
    // Create a channel to receive the token/fragment
    let (tx, rx) = oneshot::channel::<Result<String, String>>();

    // Store the sender in an Arc so we can share it
    let tx_arc = Arc::new(tokio::sync::Mutex::new(Some(tx)));

    // Callback page HTML that extracts fragment and posts it to our server
    let callback_page = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Completing Authentication...</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        h1 { color: #333; margin-bottom: 1rem; }
        p { color: #666; }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <h1>Completing Authentication...</h1>
        <p>Please wait while we finish signing you in.</p>
    </div>
    <script>
        (function() {
            console.log('🔵 [CALLBACK] Full URL:', window.location.href);
            console.log('🔵 [CALLBACK] Hash:', window.location.hash);
            console.log('🔵 [CALLBACK] Search:', window.location.search);
            console.log('🔵 [CALLBACK] Pathname:', window.location.pathname);
            
            // Extract fragment from URL (Firebase puts tokens here)
            const fragment = window.location.hash.substring(1);
            const query = window.location.search.substring(1);
            
            console.log('🔵 [CALLBACK] Fragment:', fragment);
            console.log('🔵 [CALLBACK] Query:', query);
            
            // Combine both fragment and query params
            const fullParams = fragment || query;
            
            console.log('🔵 [CALLBACK] Full params:', fullParams);
            
            if (fullParams) {
                console.log('🔵 [CALLBACK] Sending params to server...');
                // Send the fragment/params to our server
                fetch('http://localhost:8080/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fragment: fullParams })
                })
                .then(response => {
                    console.log('🔵 [CALLBACK] Server response status:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('🔵 [CALLBACK] Server response data:', data);
                    if (data.success) {
                        document.querySelector('h1').textContent = '✅ Authentication Successful!';
                        document.querySelector('p').textContent = 'You can close this window.';
                        document.querySelector('.spinner').style.display = 'none';
                    } else {
                        document.querySelector('h1').textContent = '❌ Error';
                        document.querySelector('p').textContent = data.message || 'Authentication failed';
                        document.querySelector('.spinner').style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('🔵 [CALLBACK] Fetch error:', error);
                    document.querySelector('h1').textContent = '❌ Error';
                    document.querySelector('p').textContent = 'Failed to complete authentication: ' + error.message;
                    document.querySelector('.spinner').style.display = 'none';
                });
            } else {
                console.error('🔵 [CALLBACK] No params found in URL');
                console.error('🔵 [CALLBACK] Full URL was:', window.location.href);
                document.querySelector('h1').textContent = '❌ No authentication data';
                document.querySelector('p').textContent = 'Please check the browser console for details.';
                document.querySelector('.spinner').style.display = 'none';
            }
        })();
    </script>
</body>
</html>
    "#;

    let router = Router::new()
        .route("/", get(move || {
            let html = callback_page.to_string();
            async move { Html(html) }
        }))
        .route("/callback", get(move || {
            let html = callback_page.to_string();
            async move { Html(html) }
        }))
        .route("/token", post(move |body: axum::Json<TokenPayload>| {
            handle_token(body, tx_arc.clone())
        }));

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], OAUTH_CALLBACK_PORT));
    
    let _server_handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;
        
        axum::serve(listener, router)
            .await
            .map_err(|e| format!("Server error: {}", e))?;
        
        Ok::<(), String>(())
    });

    // Small delay to ensure server is ready
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Open the browser
    open::that(&oauth_url).map_err(|e| format!("Failed to open browser: {}", e))?;

    // Wait for the callback (with timeout)
    let result = tokio::select! {
        result = rx => {
            match result {
                Ok(Ok(token)) => Ok(token),
                Ok(Err(e)) => Err(e),
                Err(_) => Err("Callback channel closed".to_string()),
            }
        }
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(300)) => {
            Err("OAuth flow timed out after 5 minutes".to_string())
        }
    };

    // Server will be cleaned up when the handle is dropped
    result
}

async fn handle_token(
    body: axum::Json<TokenPayload>,
    tx: Arc<tokio::sync::Mutex<Option<oneshot::Sender<Result<String, String>>>>>,
) -> Json<TokenResponse> {
    if let Some(tx) = tx.lock().await.take() {
        let _ = tx.send(Ok(body.fragment.clone()));
        Json(TokenResponse {
            success: true,
            message: "Token received".to_string(),
        })
    } else {
        Json(TokenResponse {
            success: false,
            message: "Token already received".to_string(),
        })
    }
}