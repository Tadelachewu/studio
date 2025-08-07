export interface Product {
  id: string;
  providerId: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number; // e.g., 0.08 for 8%
}

export interface Provider {
  id: string;
  name: string;
}

export interface MockLoan {
  id: string;
  bankName: string;
  productName: string;
  amount: number;
  interest: number;
  repaid: number;
  status: 'Active' | 'Paid Off';
  date: Date;
}

export interface MockUser {
  phoneNumber: string;
  pin: string;
  fayidaId: string;
  isVerified: boolean;
}

export type Screen =
  | 'LANGUAGE_SELECT'
  | 'PIN'
  | 'HOME'
  | 'CHOOSE_PROVIDER'
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
  providers?: Provider[];
  products?: Product[];
  selectedProviderId?: string;
  selectedProductId?: string;
  loanAmount?: number;
  repayLoans?: MockLoan[];
  selectedRepayLoanId?: string;
  loanStatusPage: number;
  productPage?: number;
  phoneNumber: string;
  language: 'en' | 'am';
};
