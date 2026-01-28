Frontend - Astro z React dla komponentów interaktywnych:

- Astro 5 pozwala na tworzenie szybkich, wydajnych stron i aplikacji z minimalną ilością JavaScript
- React 19 zapewni interaktywność tam, gdzie jest potrzebna
- TypeScript 5 dla statycznego typowania kodu i lepszego wsparcia IDE
- Tailwind 4 pozwala na wygodne stylowanie aplikacji
- Shadcn/ui zapewnia bibliotekę dostępnych komponentów React, na których oprzemy UI
- react-hook-form do obsługi formularzy
- zod do walidacji danych.

Backend - Supabase jako kompleksowe rozwiązanie backendowe:

- Zapewnia bazę danych PostgreSQL
- Zapewnia SDK w wielu językach, które posłużą jako Backend-as-a-Service
- Jest rozwiązaniem open source, które można hostować lokalnie lub na własnym serwerze
- Posiada wbudowaną autentykację użytkowników

AI - Komunikacja z modelami przez usługę Openrouter.ai:

- Dostęp do szerokiej gamy modeli (OpenAI, Anthropic, Google i wiele innych), które pozwolą nam znaleźć rozwiązanie zapewniające wysoką efektywność i niskie koszta
- Pozwala na ustawianie limitów finansowych na klucze API

CI/CD i Hosting:

- Github Actions do tworzenia pipeline’ów CI/CD
- DigitalOcean do hostowania aplikacji za pośrednictwem obrazu docker

Testy i jakość:

- Vitest jako runner testów jednostkowych i integracyjnych w TypeScript
- React Testing Library do testów komponentów React
- Playwright do end-to-end testów przeglądarkowych kluczowych ścieżek użytkownika
- MSW (Mock Service Worker) do mockowania wywołań HTTP w testach frontendowych
- Nock (lub podobna biblioteka) do mockowania wywołań HTTP po stronie backendu (np. do OpenRouter)
- ESLint + TypeScript jako statyczna analiza w pipeline’ach CI
- Pipeline’y GitHub Actions uruchamiające lintowanie oraz testy (unit/integration) na każde pull/merge requesty, a także smoke E2E na gałęzi głównej co noc.
