# Ankiety GoPOS

System ankiet posprzedażowych dla restauracji, zintegrowany z kasą GoPOS. Klient podaje numer paragonu → aplikacja pobiera listę zakupionych produktów z GoPOS → wyświetla pytania ankietowe przypisane do kategorii produktów → zapisuje odpowiedzi i opcjonalnie wysyła kod rabatowy e-mailem.

---

## Spis treści

- [Funkcje](#funkcje)
- [Stack technologiczny](#stack-technologiczny)
- [Wymagania](#wymagania)
- [Uruchomienie](#uruchomienie)
- [Pierwsze kroki w panelu admina](#pierwsze-kroki-w-panelu-admina)
- [Zmienne środowiskowe](#zmienne-środowiskowe)
- [Struktura projektu](#struktura-projektu)
- [Architektura](#architektura)
- [API — endpointy](#api--endpointy)
- [Schemat bazy danych](#schemat-bazy-danych)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Changelog](#changelog)

---

## Funkcje

### Strona ankiety (widok klienta)
- Formularz wpisania numeru paragonu fiskalnego
- Automatyczne pobranie listy zakupionych produktów z GoPOS
- Wyświetlenie pytań dla każdego produktu (ocena 1–5, tak/nie, tekst swobodny, wybór z listy)
- Zebranie adresu e-mail i zgody marketingowej (opcjonalnie)
- Generowanie kodu rabatowego po wypełnieniu ankiety
- Wysyłka kodu rabatowego e-mailem (jeśli skonfigurowane SMTP)
- Ochrona przed duplikatami — jeden paragon, jedna ankieta

### Panel administracyjny (`/admin`)
- **Zarządzanie użytkownikami** — tworzenie i usuwanie kont adminów, zmiana haseł
- **Kategorie** — synchronizacja kategorii produktów z GoPOS, przypisywanie pytań do kategorii
- **Pytania** — tworzenie/edycja/usuwanie pytań per kategoria; typy: ocena, tak/nie, tekst, wybór
- **Produkty** — przeglądanie produktów z cache, ręczne przypisywanie do kategorii
- **Odpowiedzi** — lista wypełnionych ankiet, podgląd odpowiedzi per paragon
- **Statystyki** — zestawienie ocen per produkt (histogramy, procenty, odpowiedzi tekstowe)
- **Import pytań** — wgranie pliku `.txt` z pytaniami (szablon do pobrania), walidacja przed importem
- **Ustawienia wyglądu** — logo restauracji, zdjęcie przykładowego paragonu, instrukcja tekstowa

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async ORM), asyncpg |
| Frontend | React 18, Vite, React Router v6 |
| Baza danych | PostgreSQL 16 |
| Infrastruktura | Docker, Docker Compose |
| Integracja POS | GoPOS API v3 (OAuth2 client credentials) |
| Uwierzytelnianie | JWT Bearer tokens (PyJWT), Bcrypt (passlib) |
| E-mail | aiosmtplib (asynchroniczny klient SMTP) |
| Upload plików | FastAPI StaticFiles, UUID filenames |

---

## Wymagania

- **Docker** + **Docker Compose** (jedyne wymaganie na maszynie hosta)
- Konto GoPOS z dostępem do API:
  - Client ID
  - Client Secret
  - Organization ID
  - (uzyskasz w panelu GoPOS → Integracje → API)
- Opcjonalnie: serwer SMTP do wysyłki kodów rabatowych e-mailem

---

## Uruchomienie

### 1. Sklonuj repozytorium

```bash
git clone https://github.com/poncheck/ankiety-gopos.git
cd ankiety-gopos
```

### 2. Utwórz plik konfiguracyjny

```bash
cp .env.example .env
```

Otwórz `.env` i uzupełnij wszystkie wymagane wartości (patrz [Zmienne środowiskowe](#zmienne-środowiskowe)).

### 3. Uruchom usługi

```bash
docker compose up --build
```

Przy pierwszym uruchomieniu Docker pobiera obrazy i buduje kontenery. Migracje bazy danych uruchamiają się automatycznie.

| Usługa | Adres |
|--------|-------|
| Strona ankiety | http://localhost:3000 |
| Panel admina | http://localhost:3000/admin |
| API (docs Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

### 4. Zatrzymanie

```bash
docker compose down          # zatrzymuje kontenery
docker compose down -v       # zatrzymuje i usuwa wolumeny (dane bazy!)
```

---

## Pierwsze kroki w panelu admina

1. Wejdź na http://localhost:3000/admin i zaloguj się danymi z `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

2. **Kategorie → "Synchronizuj z GoPOS"**
   Pobiera wszystkie kategorie produktów z GoPOS i zapisuje je w bazie.

3. **Produkty → "Synchronizuj produkty"**
   Pobiera cache produktów z GoPOS i mapuje je do kategorii.

4. **Import pytań**
   - Pobierz szablon `.txt` z panelu
   - Wypełnij pytania zgodnie z formatem (kategoria, typ, treść, opcje)
   - Wgraj plik — system zwaliduje każdą linię przed importem

5. **Ustawienia**
   - Wgraj logo restauracji (jpg/png/webp/gif, max 5 MB)
   - Wgraj zdjęcie przykładowego paragonu fiskalnego
   - Dodaj instrukcję tekstową widoczną nad formularzem ankiety

6. **Użytkownicy** — utwórz dodatkowe konta adminów jeśli potrzeba.

---

## Zmienne środowiskowe

Wszystkie wartości definiujesz w pliku `.env` (na podstawie `.env.example`).

### Wymagane

| Zmienna | Opis | Przykład |
|---------|------|---------|
| `GOPOS_CLIENT_ID` | OAuth2 Client ID z panelu GoPOS | `abc123...` |
| `GOPOS_CLIENT_SECRET` | OAuth2 Client Secret z panelu GoPOS | `secret456...` |
| `GOPOS_ORGANIZATION_ID` | ID organizacji w GoPOS | `12345` |
| `DATABASE_URL` | Connection string PostgreSQL (asyncpg) | `postgresql+asyncpg://ankiety:ankiety@db:5432/ankiety` |
| `SECRET_KEY` | Klucz JWT — min. 32 losowe znaki (`openssl rand -hex 32`) | `a1b2c3...` |
| `ADMIN_USERNAME` | Login pierwszego konta admina | `admin` |
| `ADMIN_PASSWORD` | Hasło pierwszego konta admina | `silne-haslo-123` |

### Opcjonalne

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `GOPOS_BASE_URL` | `https://app.gopos.io` | URL API GoPOS |
| `ALLOWED_HOST` | — | Domena serwera dla Vite (np. `ankieta.cukru.cafe`) — wymagane gdy Vite zgłasza "Blocked request" |
| `SMTP_HOST` | — | Serwer SMTP (jeśli pusty, e-maile nie są wysyłane) |
| `SMTP_PORT` | `587` | Port SMTP (`465` = SSL, `587` = STARTTLS) |
| `SMTP_USERNAME` | — | Login SMTP |
| `SMTP_PASSWORD` | — | Hasło SMTP |
| `SMTP_FROM` | — | Nagłówek "From" (np. `Restauracja <noreply@restaurant.pl>`) |
| `SMTP_TLS` | `true` | Czy używać TLS |

> **Uwaga:** Dane GoPOS znajdziesz w panelu GoPOS → Integracje → API. Plik `.env` jest wykluczony z gita przez `.gitignore`.

---

## Struktura projektu

```
ankiety/
├── backend/                          # Aplikacja FastAPI
│   ├── main.py                       # Inicjalizacja, lifespan, rejestracja routerów
│   ├── requirements.txt              # Zależności Pythona
│   ├── Dockerfile
│   └── app/
│       ├── config.py                 # Pydantic Settings (parsowanie .env)
│       ├── database.py               # AsyncEngine + SessionFactory SQLAlchemy
│       ├── models/
│       │   ├── db.py                 # Modele ORM: Category, ProductCache, Question,
│       │   │                         # SurveyResponse, Answer, AppSettings, AdminUser
│       │   └── survey.py             # Schematy Pydantic (API request/response)
│       ├── routers/
│       │   ├── survey.py             # POST /submit, GET /bill/{bill_number}
│       │   ├── admin.py              # Auth, kategorie, pytania, produkty, odpowiedzi,
│       │   │                         # upload, import, użytkownicy
│       │   └── settings.py           # GET /api/settings (publiczny)
│       └── services/
│           ├── gopos.py              # OAuth2, cache tokenu, pobieranie danych z GoPOS
│           ├── questions.py          # Logika doboru pytań do produktów
│           └── email.py              # Asynchroniczny klient SMTP
│
├── frontend/                         # Aplikacja React + Vite
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf                    # Nginx dla trybu produkcyjnego
│   ├── Dockerfile                    # Multi-stage: dev → build → production
│   └── src/
│       ├── App.jsx                   # Routing (strona ankiety + panel admina)
│       ├── components/
│       │   ├── ReceiptForm.jsx       # Formularz numeru paragonu
│       │   └── SurveyView.jsx        # Wyświetlanie pytań i wysyłka odpowiedzi
│       ├── admin/                    # Strony panelu admina
│       │   ├── AdminLayout.jsx       # Nawigacja + chronione trasy
│       │   ├── LoginPage.jsx
│       │   ├── CategoriesPage.jsx
│       │   ├── QuestionsPage.jsx
│       │   ├── ProductsPage.jsx
│       │   ├── ResponsesPage.jsx
│       │   ├── ResponseDetailPage.jsx
│       │   ├── SettingsPage.jsx
│       │   ├── ImportPage.jsx
│       │   ├── UsersPage.jsx
│       │   └── api/admin.js          # Klient HTTP dla endpointów admina
│       └── api/
│           └── survey.js             # Klient HTTP dla endpointów ankiety
│
├── docker-compose.yml                # Usługi: postgres, backend, frontend
├── .env.example                      # Szablon zmiennych środowiskowych
└── .gitignore
```

---

## Architektura

```
┌─────────────────────────────────────────────────┐
│                  Przeglądarka                    │
│  ┌───────────────────┐  ┌──────────────────────┐ │
│  │   Strona ankiety  │  │   Panel admina /admin │ │
│  │   React + Vite    │  │   React + Vite        │ │
│  └────────┬──────────┘  └──────────┬────────────┘ │
└───────────┼─────────────────────────┼─────────────┘
            │ HTTP                    │ HTTP + JWT
            ▼                         ▼
┌─────────────────────────────────────────────────┐
│              FastAPI (port 8000)                 │
│  /api/survey/*    /api/admin/*    /api/settings  │
│                                                  │
│  ┌────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │  gopos.py  │  │questions.py │  │ email.py  │ │
│  └─────┬──────┘  └─────────────┘  └─────┬─────┘ │
└────────┼─────────────────────────────────┼───────┘
         │ OAuth2                           │ SMTP
         ▼                                 ▼
  ┌─────────────┐                   ┌─────────────┐
  │  GoPOS API  │                   │  Serwer     │
  │  (external) │                   │  e-mail     │
  └─────────────┘                   └─────────────┘
         
┌─────────────────────────────────────────────────┐
│              PostgreSQL 16                       │
│  categories · product_cache · questions          │
│  survey_responses · answers · app_settings       │
│  admin_users                                     │
└─────────────────────────────────────────────────┘
```

---

## API — endpointy

### Publiczne (bez uwierzytelniania)

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/health` | Health check |
| `GET` | `/api/settings` | Ustawienia wyglądu (logo URL, zdjęcie, instrukcja) |
| `GET` | `/api/survey/bill/{bill_number}` | Pobierz paragon i pytania ankietowe |
| `POST` | `/api/survey/submit` | Wyślij wypełnioną ankietę |

**Przykład — pobranie paragonu:**
```http
GET /api/survey/bill/123456789
```
```json
{
  "bill_number": "123456789",
  "items": [
    { "id": "abc", "name": "Burger Klasyczny", "category_id": 5 }
  ],
  "questions": [
    { "id": 1, "text": "Jak oceniasz smak?", "type": "rating" }
  ]
}
```

### Chronione — Admin (wymagany `Authorization: Bearer <token>`)

**Uwierzytelnianie:**
```http
POST /api/admin/login
Content-Type: application/json

{ "username": "admin", "password": "..." }
```
Zwraca `access_token` ważny 8 godzin.

**Użytkownicy:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/users` | Lista kont adminów |
| `POST` | `/api/admin/users` | Utwórz konto admina |
| `DELETE` | `/api/admin/users/{id}` | Usuń konto |
| `PUT` | `/api/admin/users/{id}/password` | Zmień hasło |

**Kategorie:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/categories` | Lista kategorii z liczbą pytań |
| `POST` | `/api/admin/categories/sync` | Synchronizuj z GoPOS |

**Pytania:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/categories/{id}/questions` | Pytania dla kategorii |
| `POST` | `/api/admin/categories/{id}/questions` | Utwórz pytanie |
| `PUT` | `/api/admin/questions/{id}` | Edytuj pytanie |
| `DELETE` | `/api/admin/questions/{id}` | Usuń pytanie |

**Produkty:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/products` | Lista produktów z cache |
| `POST` | `/api/admin/products/sync` | Synchronizuj z GoPOS |
| `PUT` | `/api/admin/products/{id}/category` | Przypisz kategorię do produktu |

**Odpowiedzi:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/responses` | Lista ankiet (z filtrowaniem) |
| `GET` | `/api/admin/responses/{id}` | Szczegóły ankiety z odpowiedziami |
| `DELETE` | `/api/admin/responses/{id}` | Usuń ankietę |
| `GET` | `/api/admin/responses/stats` | Statystyki per produkt |

**Import pytań:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `POST` | `/api/admin/import/validate` | Walidacja pliku `.txt` przed importem |
| `POST` | `/api/admin/import/execute` | Wykonaj import pytań |

**Ustawienia:**
| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/admin/settings` | Pobierz bieżące ustawienia |
| `POST` | `/api/admin/settings/logo` | Wgraj logo (multipart/form-data) |
| `POST` | `/api/admin/settings/receipt-image` | Wgraj zdjęcie paragonu |
| `PUT` | `/api/admin/settings/instructions` | Zaktualizuj instrukcję tekstową |

Pełna dokumentacja interaktywna (Swagger UI): http://localhost:8000/docs

---

## Schemat bazy danych

### `categories`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `gopos_id` | INT UNIQUE | ID kategorii w GoPOS |
| `name` | VARCHAR(255) | |
| `created_at` | DATETIME | |

### `product_cache`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `gopos_product_id` | INT UNIQUE, INDEX | ID produktu w GoPOS |
| `category_id` | FK → categories | |
| `name` | VARCHAR(255) | |

### `questions`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `category_id` | FK → categories | |
| `text` | TEXT | Treść pytania |
| `type` | VARCHAR(20) | `rating` / `yesno` / `text` / `choice` |
| `options` | JSON | Lista opcji dla `choice`, NULL dla pozostałych |
| `position` | INT | Kolejność wyświetlania |
| `active` | BOOL | |
| `created_at` | DATETIME | |

### `survey_responses`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `fiscal_ref_id` | VARCHAR(50) UNIQUE | Numer referencyjny paragonu fiskalnego |
| `gopos_order_number` | VARCHAR(50) | Numer zamówienia GoPOS |
| `email` | VARCHAR(255) | E-mail klienta (opcjonalny) |
| `code` | VARCHAR(20) | Wygenerowany kod rabatowy |
| `marketing_consent` | BOOL | Zgoda marketingowa |
| `created_at` | DATETIME | |

### `answers`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `response_id` | FK → survey_responses | CASCADE DELETE |
| `product_id` | VARCHAR(100) | ID pozycji z paragonu |
| `product_name` | VARCHAR(255) | |
| `question_id` | FK → questions | |
| `question_text` | TEXT | Snapshot treści pytania |
| `value` | TEXT | Odpowiedź (`"5"`, `"yes"`, `"Super!"`, `"Opcja B"`) |
| `created_at` | DATETIME | |

### `app_settings`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK (zawsze 1) | |
| `logo_filename` | VARCHAR(255) | |
| `receipt_image_filename` | VARCHAR(255) | |
| `receipt_instructions` | TEXT | |
| `updated_at` | DATETIME | |

### `admin_users`
| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | PK | |
| `username` | VARCHAR(100) UNIQUE, INDEX | |
| `password_hash` | VARCHAR(255) | bcrypt |
| `is_active` | BOOL | |
| `created_at` | DATETIME | |

**Kluczowe relacje:**
- `category` → wiele `questions` (CASCADE DELETE)
- `category` → wiele `products`
- `survey_response` → wiele `answers` (CASCADE DELETE)
- `fiscal_ref_id` UNIQUE — jeden paragon, jedna ankieta

---

## Bezpieczeństwo

| Obszar | Implementacja |
|--------|---------------|
| **GoPOS API** | Tylko odczyt — aplikacja nie zapisuje nic w GoPOS |
| **Uwierzytelnianie admina** | JWT Bearer token, ważność 8h, bcrypt dla haseł (passlib) |
| **Rate limiting logowania** | Max 5 prób / IP / 60s (ochrona przed brute-force) |
| **Upload plików** | Whitelist MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`; limit 5 MB; nazwy plików randomizowane UUID |
| **SQL injection** | Brak ryzyka — SQLAlchemy ORM z parametryzowanymi zapytaniami |
| **Duplikaty ankiet** | Constraint UNIQUE na `fiscal_ref_id` w bazie danych |
| **Walidacja wejść** | Pydantic z limitami `max_length` na wszystkich polach |
| **Sekrety** | `.env` wykluczony z gita, `SECRET_KEY` nigdy w kodzie |

---

## Changelog

### 2026-04-24
- **Zarządzanie użytkownikami w panelu admina** — tworzenie/usuwanie kont adminów, zmiana haseł bezpośrednio z UI
- **Bezpieczeństwo** — hasła adminów w bazie danych z bcrypt (passlib), rate limiting na endpoint logowania
- **Migracje** — rozdzielenie migracji DB na osobne transakcje, żeby błąd constraint nie rollbackował całości

### 2025-03-11
- **Import pytań z pliku .txt** — nowa sekcja w panelu admina; szablon do pobrania, upload pliku lub wklejenie treści, wynik importu z listą błędów per linia

### 2025-03-10
- **Ustawienia wyglądu** — logo, zdjęcie przykładowego paragonu, instrukcja tekstowa; pliki serwowane przez FastAPI StaticFiles
- **Statystyki odpowiedzi per produkt** — zakładka "Zestawienie wg produktów" z wykresami ocen, tak/nie, wyborów
- **Bezpieczeństwo** — usunięcie publicznych endpointów debug, limity długości pól wejściowych, `.gitignore`
- **`ALLOWED_HOST`** — konfiguracja dozwolonych hostów Vite przez zmienną środowiskową
- **Nazwy produktów w ankiecie** — przywrócenie `items.product` w include GoPOS API
- **GitHub** — pierwsze publiczne wydanie: https://github.com/poncheck/ankiety-gopos
