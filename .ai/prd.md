# Product Requirements Document (PRD) - AI Flashcards

## 1. Product Overview

The AI Flashcards is a web-based application designed to streamline the creation of educational flashcards. By leveraging AI, the tool automates the process of creating the flashcards, making it faster and more efficient for learners. The application also supports manual flashcard creation and includes a simple learning module that utilizes a spaced repetition algorithm to help users memorize content effectively.

## 2. User Problem

Manually creating high-quality educational flashcards is a time-consuming and tedious process. This significant time investment discourages many learners from using the spaced repetition learning method, despite its proven effectiveness for long-term memory retention. Furthermore, beginners may not know how to formulate effective flashcards. The AI Flashcards aims to solve these problems, so: speeding up the creation of high-quality flashcards and making this easier for the beginners.

## 3. Functional Requirements

- **F-01: User Authentication System**
  - Only an authenticated user can access pages other than Authentication page (which allows for logging in or signing up).
  - User can create an account using an email and password.
  - User can log in and log out.
  - User can change their password.
  - User can delete their account. All associated data will be permanently removed in a GDPR-compliant manner.
  - Important: personal data must be managed in a GDPR-compliant manner. User has the right to access and delete their personal data.

- **F-02: AI-Powered Flashcard Generation**
  - User can submit a plain text input (between 1,000 and 10,000 characters).
  - The application sends this text to LLM using API.
  - LLM generates a list of question/answer (front/back) flashcard proposals.
  - User can review each proposal individually and accept, edit, or reject it.
  - Accepted proposals can be saved to the user's flashcard collection.

- **F-03: Manual Flashcard Creation**
  - User can manually create flashcards via a simple form.
  - The form will have fields for the front (max 200 characters) and back (max 500 characters) of the flashcard.

- **F-04: Flashcard Management**
  - All of a user's flashcards are stored in a single collection.
  - A paginated list displays all saved flashcards.
  - A simple search function allows user to find specific flashcards.
  - User can view the full content of a flashcard.
  - User can edit the front and back content of a flashcard.
  - User can delete a flashcard.

- **F-05: Learning Module**
  - A dedicated "Learning Session" view presents flashcards one by one for study.
  - The session utilizes an integrated spaced repetition algorithm to determine which card to show next.
  - User views the front of the card, reveal the back, and then self-assess their recall. This feedback informs the algorithm.

- **F-06: Internal Analytics**
  - The system will log all flashcard creation events (AI-generated vs. manual).
  - It will track the acceptance rate of AI-generated proposals.
  - This data will be stored internally in the application database to measure the success criteria.

## 4. Product Boundaries

### In Scope for MVP

- A web-only application accessible via modern browsers.
- All user input and flashcard content will be plain text only.
- AI will only generate simple Question/Answer style (front/back) flashcards.
- Simple user authentication via email and password.
- All flashcards for a user are stored in a single collection without categorization or decks.
- Integration with a pre-existing, simple spaced repetition algorithm.

### Out of Scope for MVP

- Native mobile applications (iOS or Android).
- Support for other formats than plain text for user input and flashcard content.
- Social login options for authentication.
- Flashcards categorisation, decks, advanced searching, filtering.
- A proprietary or advanced repetition algorithm (e.g., SuperMemo, Anki).
- Import of various file formats (e.g., PDF, DOCX, etc.).
- Sharing flashcard sets or collaborating with other users.
- Integrations with external educational platforms or services.

## 5. User Stories

### User Authentication

- **ID**: US-001
- **Title**: New User Account Creation
- **Description**: As a new user, I want to create an account using my email and a password so that I can save and manage my flashcards.
- **Acceptance Criteria**:
  - A sign-up form with email, password and repeat password fields is available.
  - The system validates that the email is in a valid format.
  - The system checks if the email is already registered.
  - Password field must be masked.
  - Password is validated against defined security criteria (e.g., minimum length).
  - Repeat password field must match the password field.
  - Upon successful registration, the user is automatically logged in and redirected to the view for generating flashcards.
  - Authenticated user can access all other application pages whereas unauthenticated one can only access Authentication page.

- **ID**: US-002
- **Title**: User Login
- **Description**: As a registered user, I want to log in with my email and password to access my flashcards.
- **Acceptance Criteria**:
  - A login form with email and password fields is available.
  - The system validates the user's credentials.
  - Upon successful login, the user is redirected to the view for generating flashcards.
  - An appropriate error message is shown for incorrect credentials.
  - Authenticated user can access all other application pages whereas unauthenticated one can only access Authentication page.

- **ID**: US-003
- **Title**: User Logout
- **Description**: As a logged-in user, I want to log out of my account to end my session securely.
- **Acceptance Criteria**:
  - A logout button is available.
  - Clicking the logout button ends the user's session.
  - The user is redirected to the login form.

- **ID**: US-004
- **Title**: Password Change
- **Description**: As a user, I want to change my password to keep my account secure.
- **Acceptance Criteria**:
  - A dedicated form allows for the password change.
  - Password fields must be masked.
  - The user must enter their current password and a new password twice.
  - The system validates the current password before allowing the change.
  - The new password must meet defined security criteria (e.g., minimum length).

- **ID**: US-005
- **Title**: Account Deletion
- **Description**: As a user, I want to permanently delete my account and all my data.
- **Acceptance Criteria**:
  - An option to delete the account is available.
  - The user is shown a clear warning that this action is irreversible and will delete all their flashcards.
  - The user must confirm the action.
  - Upon confirmation, all user data and associated flashcards are permanently deleted from the database.

### Flashcard Creation

- **ID**: US-006
- **Title**: AI Flashcard Generation:
- **Description**: As a logged-in user, I want to paste my study notes so the AI can automatically generate flashcard proposals for me to review.
- **Acceptance Criteria**:
  - A dedicated view with a text area for input is available.
  - The text area enforces character limits (1,000-10,000 characters).
  - After pasting text and clicking "Generate," the application communicates with LLM via API to get flashcards proposals and displays them as a list.
  - In case of problems with getting proposals from LLM, an appropriate error message is shown.

- **ID**: US-007
- **Title**: Review and save AI-Generated Proposals
- **Description**: As a logged-in user, I want to review each AI proposal and decide whether to accept, edit, or reject it.
- **Acceptance Criteria**:
  - A list of generated proposals is displayed below the AI flashcards generation form.
  - A "Save Flashcards" button is present.
  - Each proposal is displayed with its front and back.
  - Each proposal has "Accept," "Edit," and "Reject" options.
  - Editing a proposal opens a modal where the front and back content can be modified.
  - Accepting a proposal marks it for saving.
  - Clicking the "Save Flashcards" button saves all "accepted" cards to the user's collection.
  - After saving, the user is redirected to the flashcards list view, where the new cards are visible.

- **ID**: US-008
- **Title**: Manual Flashcard Creation
- **Description**: As a logged-in user, I want to create a specific flashcard myself by manually entering the content for front and back.
- **Acceptance Criteria**:
  - In the flashcards list view there is a button for creating a new flashcard.
  - Clicking the button opens a modal with a form for entering the front and back content of the flashcard.
  - The form enforces character limits (200 for front, 500 for back).
  - Upon saving, the new flashcard is added to the flashcards list.

### Flashcard Management

- **ID**: US-009
- **Title**: View Flashcard Collection
- **Description**: As a logged-in user, I want to see a list of all my saved flashcards.
- **Acceptance Criteria**:
  - A dedicated view displays a list of all the user's flashcards.
  - The list is paginated to handle a large number of cards.
  - Each item in the list shows a preview of the flashcard's content (e.g., the front text).

- **ID**: US-010
- **Title**: Search for a Flashcard
- **Description**: As a logged-in user, I want to search my flashcards to quickly find a specific one.
- **Acceptance Criteria**:
  - A search input field is available in the flashcard list view.
  - The list is filtered to show only flashcards whose front or back contains the search term.

- **ID**: US-011
- **Title**: Edit a Flashcard
- **Description**: As a logged-in user, I want to edit any of my flashcards to correct a mistake or add information.
- **Acceptance Criteria**:
  - An "Edit" option is available for each flashcard in the list.
  - Clicking "Edit" opens a modal with a form pre-filled with the flashcard's current content.
  - The user can modify the front and back content.
  - Saving the changes updates the flashcard in the database and closes the modal.

- **ID**: US-012
- **Title**: Delete a Flashcard
- **Description**: As a logged-in user, I want to delete a flashcard that I no longer need.
- **Acceptance Criteria**:
  - A "Delete" option is available for each flashcard in the list.
  - Clicking "Delete" prompts the user with a confirmation dialog.
  - Upon confirmation, the flashcard is permanently removed from the user's collection.

### Learning Module

- **ID**: US-013
- **Title**: Start a Learning Session
- **Description**: As a logged-in user, I want to start a study session to learn my flashcards.
- **Acceptance Criteria**:
  - A "Learning Session" button is available.
  - Clicking it navigates the user to the dedicated view, where the spaced repetition algorithm prepares a learning session.
  - The front of the first flashcard is displayed.

- **ID**: US-014
- **Title**: Study a Flashcard
- **Description**: As a logged-in user in a learning session, I want to see the front of a flashcard, try to recall the answer, and then see the back.
- **Acceptance Criteria**:
  - In the Learning Session view the front of a flashcard is displayed.
  - A "Reveal Answer" button is present.
  - Clicking the button reveals the back of the flashcard.

- **ID**: US-015
- **Title**: Self-Assess Recall
- **Description**: As a logged-in user, after seeing the back of a flashcard, I want to provide feedback on how well I remembered it to improve future sessions.
- **Acceptance Criteria**:
  - After the back of a flashcard is revealed, options for self-assessment are displayed.
  - The user's self-assessment is recorded and sent to the spaced repetition algorithm.
  - The system then presents the next flashcard based on the algorithm's logic.

## 6. Success Metrics

- **SM-01: AI-Generated Flashcard Acceptance Rate**
  - **Metric**: The percentage of flashcards proposed by the AI that are accepted by the user (either directly or after editing).
  - **Target**: 75%
  - **Measurement**: The internal logging system will record every AI-proposed card and whether it was "accepted" or "rejected." The metric will be calculated as `(Accepted Cards / Total Proposed Cards) * 100`.

- **SM-02: AI Adoption Rate for Flashcard Creation**
  - **Metric**: The percentage of a user's total flashcards that were created using the AI generation feature.
  - **Target**: 75%
  - **Measurement**: The logging system will track the origin of every saved flashcard ("AI-generated" or "manual"). The metric will be calculated as `(AI-Generated Cards / Total Saved Cards) * 100`.
