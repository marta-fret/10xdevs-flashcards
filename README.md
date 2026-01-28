# AI Flashcards

![Project Status](https://img.shields.io/badge/status-in%20development-yellowgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Project Description

AI Flashcards is a web-based application designed to streamline the creation of educational flashcards. By leveraging AI, the tool automates the process, making it faster and also more efficient for beginners. The application also supports manual flashcard creation and includes a simple learning module that utilizes a spaced repetition algorithm to help users memorize content effectively.

The primary goal is to solve the problem of manual flashcard creation being a time-consuming and tedious process, which often discourages learners from using this effective study method.

## Tech Stack

The project uses a modern tech stack for a high-performance, scalable, and maintainable application.

- **Frontend**:
  - **Astro 5**: For building fast, content-focused websites.
  - **React 19**: For creating interactive and dynamic user interface components.
  - **TypeScript 5**: For static typing, ensuring code quality and better developer experience.
  - **Tailwind CSS 4**: A utility-first CSS framework for rapid UI development.
  - **Shadcn/ui**: A library of accessible and reusable React components.

- **Backend**:
  - **Supabase**: An open-source providing a PostgreSQL database, authentication.

- **AI Integration**:
  - **OpenRouter.ai**: A service that provides access to a wide range of Large Language Models (LLMs) for generating flashcard content efficiently.

- **Testing & Quality**:
  - **Vitest**: Planned primary test runner for unit and integration tests in TypeScript.
  - **React Testing Library**: For testing React components and user interactions.
  - **Playwright**: For end-to-end browser tests of critical user flows.
  - **ESLint + TypeScript**: For static analysis and code style checks.

- **CI/CD & Hosting**:
  - **GitHub Actions**: For automating continuous integration and deployment pipelines, including linting and running unit/integration tests on pull/merge requests.
  - **DigitalOcean**: For hosting the application using Docker containers.

## Getting Started Locally

To run the project locally, follow these steps.

### Prerequisites

- **Node.js**: Version `22.14.0`. It is recommended to use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to manage Node.js versions.
- **npm**: Should be installed with Node.js.

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/10xdevs-flashcards.git
    cd 10xdevs-flashcards
    ```

2.  **Set the Node.js version**:
    If you are using `nvm`, run the following command to use the correct Node.js version:

    ```bash
    nvm use
    ```

3.  **Install dependencies**:
    ```bash
    npm install
    ```

### Environment Variables

Create a `.env` file in the root of the project and add the necessary environment variables for Supabase and OpenRouter. You can copy the example file:

```bash
cp .env.example .env
```

Then, fill in the required values:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### Running the Application

Start the development server by running:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Available Scripts

The following scripts are available in the `package.json`:

- `npm run dev`: Starts the Astro development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Previews the production build locally.
- `npm run lint`: Lints the codebase using ESLint.
- `npm run lint:fix`: Lints the codebase and automatically fixes issues.
- `npm run format`: Formats the code using Prettier.
- `npm run astro`: To run Astro commands.

## Project Scope

The project includes the following key functionalities:

- **User Authentication**: Basic user authentication and account management.
- **AI-Powered Flashcard Generation**: Automated flashcard creation from plain text using AI.
- **Manual Flashcard Creation**: Standard form-based creation of flashcards.
- **Flashcard Management**: Tools for viewing, searching, editing, and deleting flashcards.
- **Learning Module**: Study session feature using an integrated spaced repetition algorithm.
- **Internal Analytics**: Tracking flashcards creation to measure success criteria.

## Project Status

This project is currently **in development**. The initial focus is on delivering the Minimum Viable Product (MVP) with the core features outlined in the project scope.

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for more details.
