---
title: Notes on OAuth 2.0
post: 2024-11-04-notes-on-oauth-2-0.md
date: 2024-11-04T21:03:05+0800
tags: [api, oauth_2.0, tokens]
---
# Notes on OAuth 2.0

OAuth 2.0 is an open authorization framework that allows applications to access resources on behalf of a user, without exposing the user's credentials. It enables secure access by providing access tokens for API requests, facilitating delegated permissions across services.

**Security:**

- Tokens never exposed to browser
- Session cookie only contains session ID
- Session cookie typically expires in 24 hours or on browser close
- Tokens stored securely on server

**User Experience:**

- Seamless token refresh
- No need to re-login when token expires
- Single sign-on benefits
## Phases

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client App
    participant AS as Auth Server
    participant RS as Resource Server

    note over U,RS: Phase 1: Authorization Code Request
    U->>C: 1. Clicks "Login with Service"
    C->>AS: 2. Authorization Request
    Note right of C: GET /authorize?<br/>client_id=123&<br/>redirect_uri=https://app/callback&<br/>response_type=code&<br/>scope=read_profile&<br/>state=xyz789
    AS->>U: 3. Shows Login & Consent Page
    U->>AS: 4. Logs in & Approves Access
    AS->>C: 5. Redirects with Auth Code
    Note right of AS: GET /callback?<br/>code=AUTH_CODE_123&<br/>state=xyz789

    note over U,RS: Phase 2: Token Exchange
    C->>AS: 6. Token Request
    Note right of C: POST /token<br/>client_id=123&<br/>client_secret=SECRET&<br/>grant_type=authorization_code&<br/>code=AUTH_CODE_123&<br/>redirect_uri=https://app/callback
    AS->>AS: 7. Validates Auth Code
    AS->>C: 8. Returns Tokens
    Note right of AS: {<br/>"access_token": "ACCESS_789",<br/>"refresh_token": "REFRESH_111",<br/>"expires_in": 3600<br/>}

    note over U,RS: Phase 3: Resource Access
    C->>RS: 9. API Request with Access Token
    Note right of C: GET /api/resource<br/>Authorization: Bearer ACCESS_789
    RS->>RS: 10. Validates Token
    RS->>C: 11. Returns Protected Resource
    
    note over U,RS: Phase 4: Token Refresh (When Access Token Expires)
    C->>AS: 12. Refresh Token Request
    Note right of C: POST /token<br/>grant_type=refresh_token&<br/>refresh_token=REFRESH_111&<br/>client_id=123&<br/>client_secret=SECRET
    AS->>C: 13. Returns New Access Token
    Note right of AS: {<br/>"access_token": "NEW_ACCESS_999",<br/>"expires_in": 3600<br/>}
```

## Token Refreshing Process

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Client (Your Server)
    participant AS as Auth Server (Google)

    Note over B,AS: Initial Login (happens once)
    B->>C: 1. User visits site
    C->>AS: 2. Redirect to Google login
    AS->>B: 3. Login page
    B->>AS: 4. User logs in
    AS->>C: 5. Auth code
    C->>AS: 6. Exchange for tokens
    Note right of C: Receives:<br/>- Access Token (30 min)<br/>- Refresh Token (long-lived)<br/>- ID Token (user info)
    C->>B: 7. Set session cookie
    Note right of C: Cookie contains<br/>session ID only

    Note over B,AS: Later: Access Token Expired
    B->>C: 8. Makes request
    C->>C: 9. Checks token<br/>found expired
    C->>AS: 10. Uses refresh token<br/>to get new access token
    AS->>C: 11. New access token
    C->>B: 12. Serves request
    Note right of B: User never sees<br/>this process
```

## Token Validation Process

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    participant R as Redis/DB
    participant AS as Auth Server (Google)

    Note over B,AS: Scenario 1: Valid Token
    B->>S: 1. Request with session_id cookie
    S->>R: 2. Lookup user_id by session_id
    R->>S: 3. Returns user_id
    S->>R: 4. Get tokens for user_id
    R->>S: 5. Returns tokens
    S->>S: 6. Check token expiration
    Note right of S: Token still valid
    S->>B: 7. Return requested resource

    Note over B,AS: Scenario 2: Expired Token
    B->>S: 1. Request with session_id cookie
    S->>R: 2. Lookup user_id by session_id
    R->>S: 3. Returns user_id
    S->>R: 4. Get tokens for user_id
    R->>S: 5. Returns tokens
    S->>S: 6. Check token expiration
    Note right of S: Token expired!
    S->>AS: 7. Refresh token request
    AS->>S: 8. New access token
    S->>R: 9. Store new tokens
    S->>B: 10. Return requested resource

    Note over B,AS: Scenario 3: Invalid Session
    B->>S: 1. Request with invalid session_id
    S->>R: 2. Lookup user_id by session_id
    R->>S: 3. Returns null
    S->>B: 4. Return 401 Unauthorized
```

## token flow

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant C as Client App (Your Server)
    participant R as Redis/DB
    participant AS as Auth Server (Google)
    participant RS as Resource Server

    note over U,RS: Phase 1: Initial OAuth Login
    U->>B: 1. Clicks "Login with Google"
    B->>C: 2. Request login
    C->>AS: 3. Authorization Request
    Note right of C: GET /authorize?<br/>client_id=123&<br/>redirect_uri=https://app/callback&<br/>response_type=code&<br/>scope=read_profile&<br/>state=xyz789
    AS->>B: 4. Shows Login & Consent Page
    U->>AS: 5. Logs in & Approves Access
    AS->>C: 6. Redirects with Auth Code
    Note right of AS: GET /callback?<br/>code=AUTH_CODE_123&<br/>state=xyz789

    note over U,RS: Phase 2: Token Exchange & Session Setup
    C->>AS: 7. Exchange auth code for tokens
    Note right of C: POST /token<br/>client_id=123&<br/>client_secret=SECRET&<br/>grant_type=authorization_code&<br/>code=AUTH_CODE_123
    AS->>C: 8. Returns Tokens
    Note right of AS: {<br/>"access_token": "ACCESS_789",<br/>"refresh_token": "REFRESH_111",<br/>"expires_in": 3600<br/>}
    C->>R: 9. Store tokens
    Note right of C: Store in Redis/DB:<br/>user_id: user123<br/>access_token: ACCESS_789<br/>refresh_token: REFRESH_111
    C->>B: 10. Set session cookie
    Note right of B: Cookie contains only:<br/>session_id: "sess_xyz"

    note over U,RS: Phase 3: Subsequent API Requests
    B->>C: 11. Request with session cookie
    Note right of B: Cookie: session_id=sess_xyz
    C->>R: 12. Look up user_id & tokens
    R->>C: 13. Return tokens
    C->>RS: 14. API request with access token
    Note right of C: Authorization: Bearer ACCESS_789
    RS->>C: 15. Return resource
    C->>B: 16. Send response to browser

    note over U,RS: Phase 4: Token Refresh (Automatic)
    B->>C: 17. Later request with session cookie
    C->>R: 18. Look up tokens
    R->>C: 19. Return tokens (expired)
    C->>AS: 20. Refresh token request
    Note right of C: POST /token<br/>grant_type=refresh_token<br/>refresh_token=REFRESH_111
    AS->>C: 21. New access token
    C->>R: 22. Update stored tokens
    Note right of C: Update Redis/DB with<br/>new access_token
    C->>RS: 23. Retry API request
    RS->>C: 24. Return resource
    C->>B: 25. Send response
    Note right of B: Same session cookie<br/>continues to work
```