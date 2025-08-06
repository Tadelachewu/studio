import { type MockLoan } from '@/lib/mock-data';

export type Screen =
  | 'LANGUAGE_SELECT'
  | 'PIN'
  | 'HOME'
  | 'CHOOSE_BANK'
  | 'CHOOSE_PRODUCT'
  | 'APPLY_LOAN_AMOUNT'
  | 'APPLY_LOAN_CONFIRM'
  | 'LOAN_STATUS'
  | 'REPAY_SELECT_LOAN'
  | 'REPAY_ENTER_AMOUNT'
  | 'LOAN_HISTORY';

export type SessionData = {
  screen: Screen;
  pinAttempts: number;
  authenticated: boolean;
  selectedBankName?: string;
  selectedProductName?: string;
  loanAmount?: number;
  repayLoans?: MockLoan[];
  selectedRepayLoanId?: string;
  loanStatusPage: number;
  productPage?: number;
  phoneNumber: string;
  language: 'en' | 'am';
};
