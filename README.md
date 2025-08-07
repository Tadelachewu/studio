# NIB Loan USSD Application

This is a USSD-based loan application system built with Next.js. It provides a menu-driven interface for users to apply for loans, check their loan status, manage repayments, and more, all via USSD.

## Features

- **USSD Interface**: Menu-based navigation accessible via a USSD gateway.
- **Localization**: Supports both English and Amharic.
- **Dynamic Data**: Fetches loan providers and products from an external API.
- **Session Management**: Handles multi-step user interactions.
- **Input Validation**: Securely validates all user inputs.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (or yarn)
- [Git](https://git-scm.com/)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### 1. Clone the Repository

First, clone the project from your Git repository to your local machine:

```bash
git clone <your-repository-url>
cd <project-directory>
```

### 2. Install Dependencies

Install the necessary Node.js packages using npm:

```bash
npm install
```

### 3. Set Up Environment Variables

The application connects to an external backend for fetching loan data. You need to configure the URL for this API.

Create a new file named `.env` in the root of your project and add the following line:

```env
# URL for the external loan service backend
API_BASE_URL=https://wise-spoons-grow.loca.lt
```

Replace the URL with your actual backend service URL if it's different.

### 4. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will now be running at `http://localhost:9006`.

## How to Test the USSD Flow

Since this is a USSD application, you cannot test it directly in a web browser. The main endpoint is `/api/ussd`, which expects `POST` requests formatted like those from a USSD gateway (e.g., Africa's Talking).

You can use tools like `curl` or Postman to simulate USSD requests.

### Example Request with `curl`:

Here's an example of how to initiate a session:

```bash
curl -X POST http://localhost:9006/api/ussd \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "sessionId=test_session_123&phoneNumber=+251900000001&text="
```

- `sessionId`: A unique string to identify the user's session.
- `phoneNumber`: The user's phone number (must be one of the registered numbers in `src/lib/mock-data.ts`).
- `text`: The user's input. For the first request, this is empty.

The application will respond with the first menu (language selection). You can then continue the session by sending subsequent requests with the same `sessionId` and the `text` field containing the user's menu choice.
