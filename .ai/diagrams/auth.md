# Authentication Architecture

<authentication_analysis>
1. **Authentication Flows**:
   - **Initial Request / Route Guard**: The middleware intercepts requests to protected routes (`/generate`, `/flashcards`, etc.) to verify the user session via Supabase.
   - **Login**: User submits credentials via `LoginForm`. The Astro API communicates with Supabase Auth to validate credentials and establish a session.
   - **Sign Up**: New user registration via `SignUpForm`. The Astro API requests Supabase Auth to create a new user.
   - **Logout**: User terminates the session. Astro API notifies Supabase and clears cookies.
   - **Account Deletion**: User requests account removal. Astro API coordinates data cleanup and auth user deletion.

2. **Actors & Interactions**:
   - **Browser**: Initiates requests, renders UI, handles client-side redirection and feedback (toasts).
   - **Middleware**: Runs on the server (Astro) for every request. Checks `context.locals.supabase.auth.getUser()` to enforce access control.
   - **Astro API**: Server-side API endpoints (`src/pages/api/auth/*`) that handle mutation requests (POST) and communicate with Supabase.
   - **Supabase Auth**: The identity provider handling user storage, JWT generation, and validation.

3. **Step Descriptions**:
   - The **Middleware** acts as the gatekeeper, redirecting unauthenticated users to `/login` and authenticated users away from `/login`.
   - **Login/Signup** endpoints proxy requests to Supabase, setting the returned session cookies so the browser and middleware can persist the state.
   - **Logout** ensures both the Supabase session is invalidated and the local cookies are cleared.
   - **Account Deletion** is a critical security action requiring authentication verification before destructive operations.
</authentication_analysis>

<mermaid_diagram>
```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Middleware
    participant API as Astro API
    participant Supabase as Supabase Auth

    Note over Browser, Supabase: 1. Route Protection (Middleware Guard)
    Browser->>Middleware: GET /generate (Protected Route)
    activate Middleware
    Middleware->>Supabase: getUser() (Check Cookies)
    activate Supabase
    Supabase-->>Middleware: User Session / Null
    deactivate Supabase
    
    alt User Authenticated
        Middleware->>Browser: Render Page (/generate)
    else User Unauthenticated
        Middleware->>Browser: Redirect 302 to /login
    end
    deactivate Middleware

    Note over Browser, Supabase: 2. Login Flow
    Browser->>API: POST /api/auth/login (email, password)
    activate API
    API->>Supabase: signInWithPassword(email, password)
    activate Supabase
    
    alt Credentials Valid
        Supabase-->>API: Session (Access/Refresh Tokens)
        API->>Browser: 200 OK (Set-Cookie: sb-access-token, etc.)
        Browser->>Browser: Redirect to /generate
    else Credentials Invalid
        Supabase-->>API: Error (Invalid Login)
        deactivate Supabase
        API->>Browser: 401 Unauthorized
        Browser->>Browser: Show Error Toast
    end
    deactivate API

    Note over Browser, Supabase: 3. Sign Up Flow
    Browser->>API: POST /api/auth/signup (email, password)
    activate API
    API->>Supabase: signUp(email, password)
    activate Supabase
    
    alt Registration Successful
        Supabase-->>API: New User Session
        API->>Browser: 201 Created (Set-Cookie: sb-access-token)
        Browser->>Browser: Redirect to /generate
    else Registration Failed
        Supabase-->>API: Error (e.g. User exists)
        deactivate Supabase
        API->>Browser: 400/409 Error
        Browser->>Browser: Show Error Toast
    end
    deactivate API

    Note over Browser, Supabase: 4. Logout Flow
    Browser->>API: POST /api/auth/logout
    activate API
    API->>Supabase: signOut()
    activate Supabase
    Supabase-->>API: Success
    deactivate Supabase
    API->>Browser: 200 OK (Clear-Cookie)
    deactivate API
    Browser->>Browser: Redirect to /login

    Note over Browser, Supabase: 5. Account Deletion
    Browser->>API: POST /api/auth/delete-account
    activate API
    API->>Supabase: getUser()
    activate Supabase
    Supabase-->>API: Valid Session
    deactivate Supabase
    
    alt Authenticated
        par Delete Data
            API->>API: Delete User Flashcards (DB)
        and Delete User
            API->>Supabase: deleteUser(userId)
            API->>Supabase: signOut()
        end
        API->>Browser: 200 OK
        Browser->>Browser: Redirect to /login
    else Not Authenticated
        API->>Browser: 401 Unauthorized
    end
    deactivate API
```
</mermaid_diagram>
