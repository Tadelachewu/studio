import { NextResponse } from 'next/server';
import { type MockLoan, MockDatabase } from '@/lib/mock-data';
import { mockBanks } from '@/lib/mock-data';

type Screen = 
  | "PIN" | "HOME" | "CHOOSE_BANK" | "CHOOSE_PRODUCT" | "APPLY_LOAN_AMOUNT" 
  | "APPLY_LOAN_CONFIRM" | "LOAN_STATUS" | "REPAY_SELECT_LOAN" | "REPAY_ENTER_AMOUNT"
  | "CHANGE_PIN" | "TRANSACTION_HISTORY";

type SessionData = {
  screen: Screen;
  pinAttempts: number;
  authenticated: boolean;
  selectedBankName?: string;
  selectedProductName?: string;
  loanAmount?: number;
  repayLoans?: MockLoan[];
  selectedRepayLoanId?: string;
  loanStatusPage: number;
  phoneNumber: string;
};

// In-memory session store
const sessions = new Map<string, SessionData>();

function getMenuText(currentSession: SessionData): string {
  switch (currentSession.screen) {
    case 'PIN':
      return `Enter your 4-digit PIN:`;
    case 'HOME':
      return `Welcome to Microloan USSD.\n1. Apply for Loan\n2. Check Loan Status\n3. Repay Loan\n4. Check Balance\n5. Transaction History\n6. Change PIN\n0. Exit`;
    case 'CHOOSE_BANK':
      return `Select Bank:\n${mockBanks.map((b, i) => `${i + 1}. ${b.name}`).join("\n")}\n0. Home`;
    case 'CHOOSE_PRODUCT': {
      const bank = mockBanks.find(b => b.name === currentSession.selectedBankName);
      if (!bank) return "Error: Bank not found. \n0. Home";
      return `Choose a loan product:\n${bank.loanProducts.map((p, i) => `${i + 1}. ${p.name} (Amount: ${p.minAmount}-${p.maxAmount})`).join("\n")}\n0. Home\n99. Back`;
    }
    case 'APPLY_LOAN_AMOUNT': {
      const bank = mockBanks.find(b => b.name === currentSession.selectedBankName);
      const product = bank?.loanProducts.find(p => p.name === currentSession.selectedProductName);
      if (!product) return "Error: Product not found. \n0. Home";
      return `Enter amount (range: ${product.minAmount}-${product.maxAmount})\n0. Home\n99. Back`;
    }
    case 'APPLY_LOAN_CONFIRM': {
      return `Confirm:\nProduct: ${currentSession.selectedProductName}\nAmount: ${currentSession.loanAmount}\n1. Confirm\n0. Home\n99. Back`;
    }
    case 'LOAN_STATUS': {
      const userLoans = MockDatabase.getLoans(currentSession.phoneNumber);
      if (userLoans.length === 0) return "You have no loans.\n0. Home";
      const pageSize = 2;
      const page = currentSession.loanStatusPage;
      const loansToShow = userLoans.slice(page * pageSize, (page + 1) * pageSize);
      let response = "Your Loan Status:\n";
      response += loansToShow.map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${(page*pageSize) + i + 1}. ${loan.bankName}, ${loan.productName}, Outstanding: ${outstanding.toFixed(2)}`;
      }).join('\n');

      if ((page + 1) * pageSize < userLoans.length) response += "\n9. More";
      response += "\n0. Home";
      return response;
    }
    case 'REPAY_SELECT_LOAN': {
      const loans = currentSession.repayLoans || [];
      if(loans.length === 0) return "No active loans to repay.\n0. Home";
      let response = "Select loan to repay:\n";
      response += loans.map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${i + 1}. ${loan.bankName} - ${loan.productName} (Outstanding: ${outstanding.toFixed(2)})`;
      }).join('\n');
      response += "\n0. Home";
      return response;
    }
    case 'REPAY_ENTER_AMOUNT': {
      const loan = (currentSession.repayLoans || []).find(l => l.id === currentSession.selectedRepayLoanId);
      if(!loan) return "Error: Loan not found.\n0. Home";
      const outstanding = loan.amount + loan.interest - loan.repaid;
      return `Enter amount to repay (Outstanding: ${outstanding.toFixed(2)})\n0. Home\n99. Back`;
    }
    case 'CHANGE_PIN':
      return `Enter new 4-digit PIN:\n0. Home`;
    case 'TRANSACTION_HISTORY': {
      const transactions = MockDatabase.getTransactions(currentSession.phoneNumber).slice(-5);
      if (transactions.length === 0) return "No transactions found.\n0. Home";
      return `Transaction History:\n${transactions.join('\n')}\n0. Home`;
    }
    default: return `Invalid Screen.\n0. Exit`;
  }
}

export async function POST(req: Request) {
  const body = await req.formData();
  const sessionId = body.get('sessionId') as string;
  const phoneNumber = body.get('phoneNumber') as string;
  const text = body.get('text') as string;

  const userInput = text.split('*').pop()?.trim() || '';

  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      screen: 'PIN',
      pinAttempts: 0,
      authenticated: false,
      loanStatusPage: 0,
      phoneNumber,
    };
  }

  let responsePrefix = '';
  let responseMessage = '';
  let nextSession = { ...session };

  const goHome = () => {
    nextSession.screen = 'HOME';
  };

  switch (session.screen) {
      case 'PIN':
        const pin = MockDatabase.getPin(phoneNumber) || "1234";
        if (userInput.length === 4 && /^\d+$/.test(userInput)) {
          if (userInput === pin) {
            nextSession.authenticated = true;
            nextSession.screen = 'HOME';
            nextSession.pinAttempts = 0;
          } else {
            nextSession.pinAttempts++;
            if (nextSession.pinAttempts >= 3) {
              responseMessage = `Too many incorrect PIN attempts. Session ended.`;
              responsePrefix = 'END';
              sessions.delete(sessionId);
            } else {
              responseMessage = `Incorrect PIN. Attempt ${nextSession.pinAttempts} of 3. Try again:`;
            }
          }
        } else {
            responseMessage = "Invalid PIN format. Enter your 4-digit PIN:";
        }
        break;

      case 'HOME':
        switch (userInput) {
          case '1': nextSession.screen = 'CHOOSE_BANK'; break;
          case '2': nextSession.screen = 'LOAN_STATUS'; nextSession.loanStatusPage = 0; break;
          case '3': 
            nextSession.screen = 'REPAY_SELECT_LOAN';
            nextSession.repayLoans = MockDatabase.getLoans(phoneNumber).filter(l => l.status === 'Active' && (l.amount + l.interest - l.repaid) > 0);
            break;
          case '4': 
            const balance = MockDatabase.getBalance(phoneNumber);
            responseMessage = `Your account balance is: ${balance.toFixed(2)}`; 
            responsePrefix = 'END';
            sessions.delete(sessionId);
            break;
          case '5': nextSession.screen = 'TRANSACTION_HISTORY'; break;
          case '6': nextSession.screen = 'CHANGE_PIN'; break;
          case '0': 
            responseMessage = "Thank you for using Microloan USSD."; 
            responsePrefix = 'END';
            sessions.delete(sessionId);
            break;
          default: responseMessage = "Invalid choice."; break;
        }
        break;

      case 'CHOOSE_BANK':
        if(userInput === '0') { goHome(); break; }
        const bankChoice = parseInt(userInput) - 1;
        if (bankChoice >= 0 && bankChoice < mockBanks.length) {
          nextSession.screen = 'CHOOSE_PRODUCT';
          nextSession.selectedBankName = mockBanks[bankChoice].name;
        } else {
          responseMessage = "Invalid bank choice.";
        }
        break;
      
      case 'CHOOSE_PRODUCT':
        if (userInput === '0') { goHome(); break; }
        if (userInput === '99') { nextSession.screen = 'CHOOSE_BANK'; break; }

        const bank = mockBanks.find(b => b.name === session.selectedBankName);
        if (bank) {
          const productChoice = parseInt(userInput) - 1;
          if (productChoice >= 0 && productChoice < bank.loanProducts.length) {
            nextSession.screen = 'APPLY_LOAN_AMOUNT';
            nextSession.selectedProductName = bank.loanProducts[productChoice].name;
          } else {
            responseMessage = "Invalid product choice.";
          }
        }
        break;
    
      case 'APPLY_LOAN_AMOUNT':
        if (userInput === '0') { goHome(); break; }
        if (userInput === '99') { nextSession.screen = 'CHOOSE_PRODUCT'; break; }
        
        const currentBank = mockBanks.find(b => b.name === session.selectedBankName);
        const currentProduct = currentBank?.loanProducts.find(p => p.name === session.selectedProductName);
        const amount = parseFloat(userInput);
        if (currentProduct && !isNaN(amount) && amount >= currentProduct.minAmount && amount <= currentProduct.maxAmount) {
          nextSession.screen = 'APPLY_LOAN_CONFIRM';
          nextSession.loanAmount = amount;
        } else {
          responseMessage = `Invalid amount. Enter a number between ${currentProduct?.minAmount} and ${currentProduct?.maxAmount}.`;
        }
        break;

      case 'APPLY_LOAN_CONFIRM':
        if (userInput === '0') { goHome(); break; }
        if (userInput === '99') { nextSession.screen = 'APPLY_LOAN_AMOUNT'; break; }
        
        if(userInput === '1') {
          const { selectedBankName, selectedProductName, loanAmount } = session;
          const product = mockBanks.find(b => b.name === selectedBankName)?.loanProducts.find(p => p.name === selectedProductName);
          if(selectedBankName && selectedProductName && loanAmount && product) {
            MockDatabase.addLoan(phoneNumber, selectedBankName, selectedProductName, loanAmount, loanAmount * product.interestRate);
            responseMessage = `Application for ${loanAmount.toFixed(2)} for ${selectedProductName} submitted! Amount credited.`;
            responsePrefix = 'END';
            sessions.delete(sessionId);
          } else {
            responseMessage = "An error occurred. Please try again.";
            goHome();
          }
        } else {
          responseMessage = "Invalid choice.";
        }
        break;

      case 'LOAN_STATUS':
        if(userInput === '0') { goHome(); break; }
        if(userInput === '9') {
          const userLoans = MockDatabase.getLoans(phoneNumber);
          const pageSize = 2;
          if ((session.loanStatusPage + 1) * pageSize < userLoans.length) {
            nextSession.loanStatusPage = session.loanStatusPage + 1;
          }
        }
        break;

      case 'REPAY_SELECT_LOAN':
        if (userInput === '0') { goHome(); break; }
        const repayChoice = parseInt(userInput) - 1;
        if (session.repayLoans && repayChoice >= 0 && repayChoice < session.repayLoans.length) {
          nextSession.screen = 'REPAY_ENTER_AMOUNT';
          nextSession.selectedRepayLoanId = session.repayLoans[repayChoice].id;
        } else {
          responseMessage = "Invalid loan selection.";
        }
        break;

      case 'REPAY_ENTER_AMOUNT':
        if (userInput === '0') { goHome(); break; }
        if (userInput === '99') { nextSession.screen = 'REPAY_SELECT_LOAN'; break; }
        
        const repayLoan = session.repayLoans?.find(l => l.id === session.selectedRepayLoanId);
        const repayAmount = parseFloat(userInput);
        if (repayLoan) {
            const outstanding = repayLoan.amount + repayLoan.interest - repayLoan.repaid;
            if (!isNaN(repayAmount) && repayAmount > 0 && repayAmount <= outstanding) {
                MockDatabase.repayLoan(phoneNumber, repayLoan.id, repayAmount);
                responseMessage = `Repayment of ${repayAmount.toFixed(2)} successful.`;
                responsePrefix = 'END';
                sessions.delete(sessionId);
            } else {
                responseMessage = `Invalid amount. Enter a number between 1 and ${outstanding.toFixed(2)}.`;
            }
        }
        break;

      case 'CHANGE_PIN':
        if (userInput === '0') { goHome(); break; }
        if (userInput.length === 4 && /^\d+$/.test(userInput)) {
            MockDatabase.setPin(phoneNumber, userInput);
            responseMessage = "PIN changed successfully.";
            responsePrefix = 'END';
            sessions.delete(sessionId);
        } else {
            responseMessage = "Invalid PIN format. Enter new 4-digit PIN.";
        }
        break;

      case 'TRANSACTION_HISTORY':
        if (userInput === '0') { goHome(); break; }
        break;
  }

  sessions.set(sessionId, nextSession);
  
  const finalMessage = responseMessage || getMenuText(nextSession);
  const responseBody = `${responsePrefix || 'CON'} ${finalMessage}`;

  return new Response(responseBody, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
