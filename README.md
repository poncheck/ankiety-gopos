# Ankiety GoPOS

System ankiet dla restauracji integrujący się z kasą GoPOS. Klient podaje numer paragonu → aplikacja pobiera listę zakupionych produktów → wyświetla pytania ankietowe przypisane do kategorii produktów → zapisuje odpowiedzi.

## Funkcje

- **Strona ankiety** — klient wpisuje numer paragonu i odpowiada na pytania dla każdego produktu
- **Panel admina** (`/admin`) — zarządzanie całym systemem:
  - **Kategorie** — synchronizacja kategorii produktów z GoPOS, przypisywanie pytań
  - **Produkty** — przeglądanie i ręczne przypisywanie kategorii do produktów
  - **Odpowiedzi** — lista paragonów z wypełnionymi ankietami, zestawienie statystyk per produkt
  - **Ustawienia** — logo, instrukcja i zdjęcie przykładowego paragonu widoczne na stronie ankiety

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL |
| Frontend | React 18, Vite, React Router |
| Baza danych | PostgreSQL 16 |
| Infrastruktura | Docker, Docker Compose |
| Integracja | GoPOS API v3 (OAuth2) |

## Wymagania

- Docker + Docker Compose
- Konto GoPOS z dostępem do API (Client ID, Client Secret, Organization ID)

## Uruchomienie

### 1. Sklonuj repo i skopiuj konfigurację

```bash
git clone https://github.com/poncheck/ankiety-gopos.git
cd ankiety
cp .env.example .env
```

### 2. Uzupełnij `.env`

```env
# Dane z panelu GoPOS → Integracje → API
GOPOS_CLIENT_ID=...
GOPOS_CLIENT_SECRET=...
GOPOS_ORGANIZATION_ID=...
GOPOS_BASE_URL=https://app.gopos.io

# Baza danych (domyślne wartości działają z docker-compose)
DATABASE_URL=postgresql+asyncpg://ankiety:ankiety@db:5432/ankiety

# JWT — wygeneruj losowy ciąg, np.: openssl rand -hex 32
SECRET_KEY=change-me-to-random-secret

# Dane logowania do panelu admina
ADMIN_USERNAME=admin
ADMIN_PASSWORD=zmien-na-silne-haslo
```

### 3. Uruchom

```bash
docker compose up --build
```

- Ankieta: http://localhost:3000
- Panel admina: http://localhost:3000/admin
- API (docs): http://localhost:8000/docs

### 4. Pierwsze kroki w panelu admina

1. **Kategorie** → "Synchronizuj z GoPOS" — pobiera kategorie produktów
2. **Produkty** → "Synchronizuj produkty" — pobiera cache produktów z GoPOS
3. **Kategorie** → wybierz kategorię → dodaj pytania ankietowe (ocena, tak/nie, tekst, wybór)
4. **Ustawienia** → dodaj logo i instrukcję

## Bezpieczeństwo

- **GoPOS API: tylko odczyt** — aplikacja wyłącznie pobiera dane (paragony, produkty, kategorie), nie zapisuje niczego w GoPOS
- **Admin auth**: JWT Bearer token, hasło w `.env` (nigdy w kodzie)
- **SQL injection**: brak ryzyka — SQLAlchemy ORM z parametryzowanymi zapytaniami
- **Upload plików**: walidacja MIME type (jpg/png/webp/gif), limit 5 MB, nazwy plików UUID
- **Sekrety**: plik `.env` jest wykluczony z repozytorium przez `.gitignore`

## Struktura projektu

```
ankiety/
├── backend/              # FastAPI
│   ├── app/
│   │   ├── models/       # ORM (SQLAlchemy) + Pydantic
│   │   ├── routers/      # Endpointy: survey, admin, settings
│   │   └── services/     # Logika biznesowa: gopos.py, questions.py
│   ├── main.py
│   └── requirements.txt
├── frontend/             # React + Vite
│   └── src/
│       ├── admin/        # Panel administracyjny
│       ├── components/   # ReceiptForm, SurveyView
│       └── api/          # Klient HTTP
├── docker-compose.yml
└── .env.example
```

## Zmienne środowiskowe

| Zmienna | Opis |
|---------|------|
| `GOPOS_CLIENT_ID` | OAuth Client ID z panelu GoPOS |
| `GOPOS_CLIENT_SECRET` | OAuth Client Secret z panelu GoPOS |
| `GOPOS_ORGANIZATION_ID` | ID organizacji w GoPOS |
| `GOPOS_BASE_URL` | URL API GoPOS (domyślnie `https://app.gopos.io`) |
| `DATABASE_URL` | Connection string PostgreSQL (asyncpg) |
| `SECRET_KEY` | Klucz do podpisywania JWT — minimum 32 losowe znaki |
| `ADMIN_USERNAME` | Login do panelu admina |
| `ADMIN_PASSWORD` | Hasło do panelu admina |
