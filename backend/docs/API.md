# UyirKappan Backend API

Base URL: `http://localhost:4000/api`

All protected endpoints require `Authorization: Bearer <token>`.

## Authentication

| Method | Path | Body | Roles |
|---|---|---|---|
| POST | /auth/register | `{name, phone, email, password, role}` | public |
| POST | /auth/login | `{email, password}` (or phone) | public |
| GET | /auth/me | – | any |

Register example:
```json
POST /api/auth/register
{ "name": "Kumar", "email": "x@y.com", "phone": "9000000000", "password": "secret", "role": "BYSTANDER" }