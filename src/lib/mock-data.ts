import { normalizePhoneNumber } from '@/lib/utils';

export interface LoanProduct {
  name: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number; // e.g., 0.08 for 8%
}

export interface Bank {
  name: string;
  loanProducts: LoanProduct[];
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

export const mockBanks: Bank[] = [
  {
    name: 'NIB Bank',
    loanProducts: [
      {
        name: 'Personal Loan',
        minAmount: 1000,
        maxAmount: 5000,
        interestRate: 0.1,
      },
      {
        name: 'Business Starter',
        minAmount: 5000,
        maxAmount: 20000,
        interestRate: 0.08,
      },
       {
        name: 'Flexi-Loan',
        minAmount: 500,
        maxAmount: 2500,
        interestRate: 0.12,
      },
    ],
  },
  {
    name: 'Dashen Bank',
    loanProducts: [
      {
        name: 'Student Loan',
        minAmount: 500,
        maxAmount: 2500,
        interestRate: 0.05,
      },
      {
        name: 'Emergency Fund',
        minAmount: 200,
        maxAmount: 1000,
        interestRate: 0.12,
      },
    ],
  },
  {
    name: 'CBE',
    loanProducts: [
      {
        name: 'Salary Advance',
        minAmount: 1500,
        maxAmount: 10000,
        interestRate: 0.09,
      },
    ],
  },
  {
    name: 'Awash Bank',
    loanProducts: [
      {
        name: 'Agri-Loan',
        minAmount: 2000,
        maxAmount: 15000,
        interestRate: 0.07,
      },
    ],
  },
];

const mockUsers: MockUser[] = [
  {
    phoneNumber: '+251900000001',
    pin: '1234',
    fayidaId: '1235678',
    isVerified: true,
  },
  {
    phoneNumber: '+251900000002',
    pin: '5678',
    fayidaId: '87654321',
    isVerified: true,
  },
  {
    phoneNumber: '+251900000003',
    pin: '4321',
    fayidaId: '11223344',
    isVerified: false,
  },
];

const initialUserLoans: Record<string, MockLoan[]> = {};

const userBalances: Record<string, number> = {
  '+251900000001': 5000.0,
  '+251900000002': 12500.75,
  '+251900000003': 800.5,
};

const userTransactions: Record<string, string[]> = {};

// In-memory database object
export const MockDatabase = {
  users: [...mockUsers],
  userLoans: JSON.parse(JSON.stringify(initialUserLoans)) as Record<
    string,
    MockLoan[]
  >, // Deep copy
  userBalances: { ...userBalances },
  userTransactions: JSON.parse(JSON.stringify(userTransactions)) as Record<
    string,
    string[]
  >,

  getUserByPhoneNumber(phoneNumber: string): MockUser | undefined {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Getting user for normalized phone: ${normalizedPhone}`);
    return this.users.find((u) => u.phoneNumber === normalizedPhone);
  },
  getPin(phoneNumber: string): string | undefined {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Getting PIN for normalized phone: ${normalizedPhone}`);
    const pin = this.users.find((u) => u.phoneNumber === normalizedPhone)?.pin;
    console.log(`[DB] Found PIN: ${pin ? '****' : 'undefined'}`);
    return pin;
  },
  setPin(phoneNumber: string, newPin: string) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const user = this.users.find((u) => u.phoneNumber === normalizedPhone);
    if (user) {
      user.pin = newPin;
      console.log(`[DB] Set new PIN for ${normalizedPhone}`);
    } else {
      console.log(`[DB] Could not set PIN, user not found for ${normalizedPhone}`);
    }
  },
  getLoans(phoneNumber: string): MockLoan[] {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Getting loans for normalized phone: ${normalizedPhone}`);
    return this.userLoans[normalizedPhone] || [];
  },
  addLoan(
    phoneNumber: string,
    bankName: string,
    productName: string,
    amount: number,
    interest: number
  ) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Adding loan for normalized phone: ${normalizedPhone}`);
    if (!this.userLoans[normalizedPhone]) {
      this.userLoans[normalizedPhone] = [];
    }
    if (!this.userTransactions[normalizedPhone]) {
      this.userTransactions[normalizedPhone] = [];
    }
    const newLoan: MockLoan = {
      id: `loan${Date.now()}`,
      bankName,
      productName,
      amount,
      interest,
      repaid: 0,
      status: 'Active',
      date: new Date(),
    };
    this.userLoans[normalizedPhone].push(newLoan);
    this.userBalances[normalizedPhone] =
      (this.userBalances[normalizedPhone] || 0) + amount;
    this.userTransactions[normalizedPhone].push(
      `Loan of ${amount.toFixed(2)} from ${bankName}`
    );
  },
  repayLoan(phoneNumber: string, loanId: string, repayAmount: number) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Repaying loan for normalized phone: ${normalizedPhone}`);
    const loan = this.userLoans[normalizedPhone]?.find((l) => l.id === loanId);
    if (loan) {
      loan.repaid += repayAmount;
      if (loan.repaid >= loan.amount + loan.interest) {
        loan.status = 'Paid Off';
      }
      this.userBalances[normalizedPhone] =
        (this.userBalances[normalizedPhone] || 0) - repayAmount;
      if (!this.userTransactions[normalizedPhone]) {
        this.userTransactions[normalizedPhone] = [];
      }
      this.userTransactions[normalizedPhone].push(
        `Repayment of ${repayAmount.toFixed(2)} to ${loan.bankName}`
      );
      console.log(`[DB] Repayment successful for loan ID ${loanId}`);
      return true;
    }
    console.log(`[DB] Repayment failed, loan ID ${loanId} not found`);
    return false;
  },
  getBalance(phoneNumber: string): number {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Getting balance for normalized phone: ${normalizedPhone}`);
    return this.userBalances[normalizedPhone] || 0;
  },
  getTransactions(phoneNumber: string): string[] {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[DB] Getting transactions for normalized phone: ${normalizedPhone}`);
    return this.userTransactions[normalizedPhone] || [];
  },
};
