import { type SessionData } from '@/lib/types';
import { mockBanks, MockDatabase } from '@/lib/mock-data';
import { translations } from '@/lib/translations';

export function getMenuText(currentSession: SessionData): string {
  const t = translations[currentSession.language];

  switch (currentSession.screen) {
    case 'LANGUAGE_SELECT':
      return `1. English\n2. አማርኛ`;
    case 'PIN':
      return t.pinPrompt;
    case 'HOME':
      return `${t.homeMenu.title}\n1. ${t.homeMenu.apply}\n2. ${t.homeMenu.status}\n3. ${t.homeMenu.repay}\n4. ${t.homeMenu.balance}\n5. ${t.homeMenu.history}\n0. ${t.homeMenu.exit}`;
    case 'CHOOSE_BANK':
      return `${t.chooseBank}\n${mockBanks
        .map((b, i) => `${i + 1}. ${b.name}`)
        .join('\n')}\n0. ${t.navigation.home}`;
    case 'CHOOSE_PRODUCT': {
      const bank = mockBanks.find(
        (b) => b.name === currentSession.selectedBankName
      );
      if (!bank) return `${t.errors.bankNotFound} \n0. ${t.navigation.home}`;

      const pageSize = 2;
      const page = currentSession.productPage || 0;
      const productsToShow = bank.loanProducts.slice(
        page * pageSize,
        (page + 1) * pageSize
      );

      let response = `${t.chooseProduct.title}\n`;
      response += productsToShow
        .map(
          (p, i) =>
            `${page * pageSize + i + 1}. ${p.name} (${t.chooseProduct.amount}: ${
              p.minAmount
            }-${p.maxAmount})`
        )
        .join('\n');
      
      if ((page + 1) * pageSize < bank.loanProducts.length) {
        response += `\n8. ${t.navigation.next}`;
      }
      if (page > 0) {
        response += `\n7. ${t.navigation.prev}`;
      }

      response += `\n0. ${t.navigation.home}\n99. ${t.navigation.back}`;
      return response;
    }
    case 'APPLY_LOAN_AMOUNT': {
      const bank = mockBanks.find(
        (b) => b.name === currentSession.selectedBankName
      );
      const product = bank?.loanProducts.find(
        (p) => p.name === currentSession.selectedProductName
      );
      if (!product) return `${t.errors.productNotFound} \n0. ${t.navigation.home}`;
      return `${t.enterAmount.prompt} (${t.enterAmount.range}: ${product.minAmount}-${product.maxAmount})\n0. ${t.navigation.home}\n99. ${t.navigation.back}`;
    }
    case 'APPLY_LOAN_CONFIRM': {
      return `${t.confirmLoan.title}\n${t.confirmLoan.product}: ${currentSession.selectedProductName}\n${t.confirmLoan.amount}: ${currentSession.loanAmount}\n1. ${t.confirmLoan.confirm}\n2. ${t.confirmLoan.cancel}\n0. ${t.navigation.home}\n99. ${t.navigation.back}`;
    }
    case 'LOAN_STATUS': {
      const userLoans = MockDatabase.getLoans(currentSession.phoneNumber);
      if (userLoans.length === 0) return `${t.loanStatus.noLoans}\n0. ${t.navigation.home}`;
      const pageSize = 2;
      const page = currentSession.loanStatusPage;
      const loansToShow = userLoans.slice(
        page * pageSize,
        (page + 1) * pageSize
      );
      let response = `${t.loanStatus.title}\n`;
      response += loansToShow
        .map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${page * pageSize + i + 1}. ${
            loan.bankName
          }, ${loan.productName}, ${t.loanStatus.outstanding}: ${outstanding.toFixed(2)}`;
        })
        .join('\n');

      if ((page + 1) * pageSize < userLoans.length) response += `\n9. ${t.navigation.more}`;
      response += `\n0. ${t.navigation.home}`;
      return response;
    }
    case 'REPAY_SELECT_LOAN': {
      const loans = currentSession.repayLoans || [];
      if (loans.length === 0) return `${t.repayLoan.noActiveLoans}\n0. ${t.navigation.home}`;
      let response = `${t.repayLoan.selectLoan}\n`;
      response += loans
        .map((loan, i) => {
          const outstanding = loan.amount + loan.interest - loan.repaid;
          return `${i + 1}. ${loan.bankName} - ${
            loan.productName
          } (${t.loanStatus.outstanding}: ${outstanding.toFixed(2)})`;
        })
        .join('\n');
      response += `\n0. ${t.navigation.home}`;
      return response;
    }
    case 'REPAY_ENTER_AMOUNT': {
      const loan = (currentSession.repayLoans || []).find(
        (l) => l.id === currentSession.selectedRepayLoanId
      );
      if (!loan) return `${t.errors.loanNotFound}\n0. ${t.navigation.home}`;
      const outstanding = loan.amount + loan.interest - loan.repaid;
      return `${t.repayLoan.enterAmount} (${t.loanStatus.outstanding}: ${outstanding.toFixed(
        2
      )})\n0. ${t.navigation.home}\n99. ${t.navigation.back}`;
    }
    case 'LOAN_HISTORY': {
      const transactions = MockDatabase.getTransactions(
        currentSession.phoneNumber
      ).slice(-5);
      if (transactions.length === 0) return `${t.loanHistory.noTransactions}\n0. ${t.navigation.home}`;
      return `${t.loanHistory.title}:\n${transactions.join('\n')}\n0. ${t.navigation.home}`;
    }
    default:
      return `${t.errors.invalidScreen}\n0. ${t.navigation.exit}`;
  }
}
