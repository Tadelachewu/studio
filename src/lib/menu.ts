import { type SessionData } from '@/lib/types';
import { mockBanks, MockDatabase } from '@/lib/mock-data';

export function getMenuText(currentSession: SessionData): string {
  switch (currentSession.screen) {
    case 'PIN':
      return `Welcome to Mobili Finance. Please enter your 4-digit PIN:`;
    case 'HOME':
      return `Welcome to Microloan USSD.\n1. Apply for Loan\n2. Check Loan Status\n3. Repay Loan\n4. Check Balance\n5. Transaction History\n6. Change PIN\n0. Exit`;
    case 'CHOOSE_BANK':
      return `Select Loan Provider:\n${mockBanks
        .map((b, i) => `${i + 1}. ${b.name}`)
        .join('\n')}\n0. Home`;
    case 'CHOOSE_PRODUCT': {
      const bank = mockBanks.find(
        (b) => b.name === currentSession.selectedBankName
      );
      if (!bank) return 'Error: Bank not found. \n0. Home';
      return `Choose a loan product:\n${bank.loanProducts
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} (Amount: ${p.minAmount}-${p.maxAmount})`
        )
        .join('\n')}\n0. Home\n99. Back`;
    }
    case 'APPLY_LOAN_AMOUNT': {
      const bank = mockBanks.find(
        (b) => b.name === currentSession.selectedBankName
      );
      const product = bank?.loanProducts.find(
        (p) => p.name === currentSession.selectedProductName
      );
      if (!product) return 'Error: Product not found. \n0. Home';
      return `Enter amount (range: ${product.minAmount}-${product.maxAmount})\n0. Home\n99. Back`;
    }
    case 'APPLY_LOAN_CONFIRM': {
      return `Confirm:\nProduct: ${currentSession.selectedProductName}\nAmount: ${currentSession.loanAmount}\n1. Confirm\n0. Home\n99. Back`;
    }
    case 'LOAN_STATUS': {
      const userLoans = MockDatabase.getLoans(currentSession.phoneNumber);
      if (userLoans.length === 0) return 'You have no loans.\n0. Home';
      const pageSize = 2;
      const page = currentSession.loanStatusPage;
      const loansToShow = userLoans.slice(
        page * pageSize,
        (page + 1) * pageSize
      );
      let response = 'Your Loan Status:\n';
      response += loansToShow
        .map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${page * pageSize + i + 1}. ${
            loan.bankName
          }, ${loan.productName}, Outstanding: ${outstanding.toFixed(2)}`;
        })
        .join('\n');

      if ((page + 1) * pageSize < userLoans.length) response += '\n9. More';
      response += '\n0. Home';
      return response;
    }
    case 'REPAY_SELECT_LOAN': {
      const loans = currentSession.repayLoans || [];
      if (loans.length === 0) return 'No active loans to repay.\n0. Home';
      let response = 'Select loan to repay:\n';
      response += loans
        .map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${i + 1}. ${loan.bankName} - ${
            loan.productName
          } (Outstanding: ${outstanding.toFixed(2)})`;
        })
        .join('\n');
      response += '\n0. Home';
      return response;
    }
    case 'REPAY_ENTER_AMOUNT': {
      const loan = (currentSession.repayLoans || []).find(
        (l) => l.id === currentSession.selectedRepayLoanId
      );
      if (!loan) return 'Error: Loan not found.\n0. Home';
      const outstanding = loan.amount + loan.interest - loan.repaid;
      return `Enter amount to repay (Outstanding: ${outstanding.toFixed(
        2
      )})\n0. Home\n99. Back`;
    }
    case 'CHANGE_PIN':
      return `Enter new 4-digit PIN:\n0. Home`;
    case 'TRANSACTION_HISTORY': {
      const transactions = MockDatabase.getTransactions(
        currentSession.phoneNumber
      ).slice(-5);
      if (transactions.length === 0) return 'No transactions found.\n0. Home';
      return `Transaction History:\n${transactions.join('\n')}\n0. Home`;
    }
    default:
      return `Invalid Screen.\n0. Exit`;
  }
}
