# Product Requirements Document (PRD) - AI Flashcards

## 1. Product Overview

The AI Flashcard Generator is a web-based application designed to streamline the creation of educational flashcards. By leveraging AI, the tool automates the process of generating flashcards from user-provided text, making it faster and more efficient for learners to create study materials. The application also supports manual flashcard creation and includes a simple, integrated learning module that utilizes a spaced repetition algorithm to help users memorize content effectively. The primary goal of the Minimum Viable Product (MVP) is to validate the core hypothesis that AI-assisted creation can significantly reduce the time and effort required to produce high-quality flashcards.

## 2. User Problem

Manually creating high-quality educational flashcards is a time-consuming and often tedious process. This significant time investment discourages many learners from using the spaced repetition learning method, despite its proven effectiveness for long-term memory retention. Furthermore, beginners may not know how to formulate effective flashcards, leading to suboptimal learning outcomes. The AI Flashcard Generator aims to solve this problem by automating the creation process, providing users with well-structured flashcard proposals, and lowering the barrier to entry for effective, long-term learning.

## 3. Functional Requirements

- *F-01: User Authentication System*
  - Users can create an account using an email and password.
  - Users can log in and log out.
  - Users can change their password.
  - Users can delete their account. All associated data will be permanently removed in a GDPR-compliant manner.

- *F-02: AI-Powered Flashcard Generation*
  - Users can submit a plain text input (between 1,000 and 10,000 characters).
  - The AI will process the text and generate a list of Question/Answer flashcard proposals.
  - Users can review each proposal individually and choose to accept, edit, or reject it.
  - Accepted and edited proposals can be saved to the user's flashcard collection.

- *F-03: Manual Flashcard Creation*
  - Users can manually create flashcards via a simple form.
  - The form will have fields for the front (max 200 characters) and back (max 500 characters) of the flashcard.

- *F-04: Flashcard Management*
  - All of a user's flashcards are stored in a single collection.
  - A paginated list displays all saved flashcards.
  - Users can view the full content of a flashcard.
  - Users can edit the front and back content of a flashcard.
  - Users can delete a flashcard.
  - A simple search function allows users to find specific flashcards.

- *F-05: Learning Module*
  - A dedicated "Learning Session" view presents flashcards one by one for study.
  - The session utilizes an integrated spaced repetition algorithm to determine which card to show next.
  - Users view the front of the card, reveal the back, and then self-assess their recall (e.g., "Correct" or "Incorrect"). This feedback informs the algorithm.

- *F-06: Internal Analytics*
  - The system will log all flashcard creation events (AI-generated vs. manual).
  - It will track the acceptance rate of AI-generated proposals.
  - This data will be stored internally in the application database to measure the success criteria.

## 4. Product Boundaries

### In Scope for MVP

- A web-only application accessible via modern browsers.
- All user input and flashcard content will be plain text only.
- AI will only generate simple Question/Answer style flashcards.
- User accounts are managed via email and password; no social logins.
- All flashcards for a user are stored in a single collection without categorization or decks.
- Integration with a pre-existing, simple spaced repetition algorithm.

### Out of Scope for MVP

- A proprietary or advanced repetition algorithm (e.g., SuperMemo, Anki).
- Import of various file formats (e.g., PDF, DOCX, etc.).
- Sharing flashcard sets or collaborating with other users.
- Integrations with external educational platforms or services.
- Native mobile applications (iOS or Android).

## 5. User Stories

### User Authentication

- *ID*: US-001
- *Title*: New User Account Creation
- *Description*: As a new user, I want to create an account using my email and a password so that I can save and manage my flashcards.
- *Acceptance Criteria*:
  - A sign-up page with fields for email and password is available.
  - Password fields must be masked.
  - The system validates that the email is in a valid format.
  - The system checks if the email is already registered.
  - Upon successful registration, the user is automatically logged in and redirected to the main dashboard.

- *ID*: US-002
- *Title*: User Login
- *Description*: As a returning user, I want to log in with my email and password to access my flashcards.
- *Acceptance Criteria*:
  - A login page with fields for email and password is available.
  - The system validates the user's credentials against the database.
  - Upon successful login, the user is redirected to their main dashboard.
  - An appropriate error message is shown for incorrect credentials.

- *ID*: US-003
- *Title*: User Logout
- *Description*: As a logged-in user, I want to log out of my account to end my session securely.
- *Acceptance Criteria*:
  - A logout button or link is available within the application.
  - Clicking the logout button ends the user's session.
  - The user is redirected to the public home page or login page after logging out.

- *ID*: US-004
- *Title*: Password Change
- *Description*: As a user, I want to change my password to keep my account secure.
- *Acceptance Criteria*:
  - A dedicated section in the user's account settings allows for password changes.
  - The user must enter their current password and a new password twice.
  - The system validates the current password before allowing the change.
  - The new password must meet defined security criteria (e.g., minimum length).

- *ID*: US-005
- *Title*: Account Deletion
- *Description*: As a user, I want to permanently delete my account and all my data.
- *Acceptance Criteria*:
  - An option to delete the account is available in the user's account settings.
  - The user is shown a clear warning that this action is irreversible and will delete all their flashcards.
  - The user must confirm the action, possibly by re-entering their password.
  - Upon confirmation, all user data and associated flashcards are permanently deleted from the database.

### Flashcard Creation

- *ID*: US-006
- *Title*: AI Flashcard Generation from Text
- *Description*: As a user, I want to paste my study notes so the AI can automatically generate flashcard proposals for me to review.
- *Acceptance Criteria*:
  - A dedicated view with a text area for input is available.
  - The text area enforces character limits (1,000-10,000 characters).
  - After pasting text and clicking "Generate," the system displays a list of AI-generated Q/A flashcard proposals.
  - The generation process provides feedback to the user (e.g., a loading indicator).

- *ID*: US-007
- *Title*: Review AI-Generated Proposals
- *Description*: As a user, I want to review each AI proposal and decide whether to accept, edit, or reject it.
- *Acceptance Criteria*:
  - Each proposal is displayed clearly with its front (Question) and back (Answer).
  - Each proposal has "Accept," "Edit," and "Reject" options.
  - Rejecting a proposal removes it from the list.
  - Editing a proposal opens a modal or inline form where the front and back content can be modified.
  - Accepting a proposal marks it for saving.

- *ID*: US-008
- *Title*: Save Accepted Flashcards
- *Description*: As a user, after reviewing the AI proposals, I want to save all my accepted flashcards to my collection.
- *Acceptance Criteria*:
  - A "Save Flashcards" button is present on the review page.
  - Clicking the button saves all "accepted" and "edited" cards to the user's collection.
  - After saving, the user is redirected to their main flashcard list, where the new cards are visible.

- *ID*: US-009
- *Title*: Manual Flashcard Creation
- *Description*: As a user, I want to create a specific flashcard myself by manually entering the content.
- *Acceptance Criteria*:
  - A form is available with fields for the front and back of the flashcard.
  - The form enforces character limits (200 for front, 500 for back).
  - Upon saving, the new flashcard is added to the user's collection.
  - The user is redirected to the main flashcard list.

### Flashcard Management

- *ID*: US-010
- *Title*: View Flashcard Collection
- *Description*: As a user, I want to see a list of all my saved flashcards.
- *Acceptance Criteria*:
  - A dedicated page displays all the user's flashcards in a list format.
  - The list is paginated to handle a large number of cards.
  - Each item in the list shows a preview of the flashcard's content (e.g., the front text).

- *ID*: US-011
- *Title*: Search for a Flashcard
- *Description*: As a user, I want to search my flashcards to quickly find a specific one.
- *Acceptance Criteria*:
  - A search input field is available on the flashcard list page.
  - As the user types, the list is filtered to show only flashcards containing the search term in their front or back content.

- *ID*: US-012
- *Title*: Edit a Flashcard
- *Description*: As a user, I want to edit a flashcard I previously made to correct a mistake or add information.
- *Acceptance Criteria*:
  - An "Edit" option is available for each flashcard in the list.
  - Clicking "Edit" opens a modal or form pre-filled with the flashcard's current content.
  - The user can modify the front and back content.
  - Saving the changes updates the flashcard in the database and closes the modal.

- *ID*: US-013
- *Title*: Delete a Flashcard
- *Description*: As a user, I want to delete a flashcard that I no longer need.
- *Acceptance Criteria*:
  - A "Delete" option is available for each flashcard in the list.
  - Clicking "Delete" prompts the user with a confirmation dialog.
  - Upon confirmation, the flashcard is permanently removed from the user's collection.

### Learning Module

- *ID*: US-014
- *Title*: Start a Learning Session
- *Description*: As a user, I want to start a study session to learn my flashcards.
- *Acceptance Criteria*:
  - A "Learning Session" or "Study" button is available.
  - Clicking it launches the learning interface.
  - The system uses the spaced repetition algorithm to select the first card to display.

- *ID*: US-015
- *Title*: Study a Flashcard
- *Description*: As a user in a learning session, I want to see the front of a flashcard, try to recall the answer, and then see the back.
- *Acceptance Criteria*:
  - The interface displays the front of a flashcard.
  - A "Reveal Answer" button is present.
  - Clicking the button reveals the back of the flashcard.

- *ID*: US-016
- *Title*: Self-Assess Recall
- *Description*: As a user, after seeing the answer, I want to provide feedback on how well I remembered it to improve future sessions.
- *Acceptance Criteria*:
  - After the answer is revealed, options for self-assessment (e.g., "Correct" and "Incorrect") are displayed.
  - The user's selection is recorded and sent to the spaced repetition algorithm.
  - The system then presents the next card based on the algorithm's logic.

## 6. Success Metrics

- *SM-01: AI-Generated Flashcard Acceptance Rate*
  - *Metric*: The percentage of flashcards proposed by the AI that are accepted by the user (either directly or after editing).
  - *Target*: 75%
  - *Measurement*: The internal logging system will record every AI-proposed card and whether it was "accepted" or "rejected." The metric will be calculated as `(Accepted Cards / Total Proposed Cards) * 100`.

- *SM-02: AI Adoption Rate for Flashcard Creation*
  - *Metric*: The percentage of a user's total flashcards that were created using the AI generation feature.
  - *Target*: 75%
  - *Measurement*: The logging system will track the origin of every saved flashcard ("AI-generated" or "manual"). The metric will be calculated as `(AI-Generated Cards / Total Saved Cards) * 100`.