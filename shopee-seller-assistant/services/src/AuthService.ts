import type { Result } from '@core/errors';
import type { User } from '@repo/domain';

/** Narrow user-store port the auth layer depends on (the real UserRepository
 *  satisfies this structurally). */
export interface UserStore {
  create(input: { email: string }): Promise<Result<User>>;
  getById(id: string): Promise<Result<User | null>>;
}

export interface AuthServiceDeps {
  readonly users: UserStore;
}

/**
 * Authentication-layer service: provisions and loads user accounts. Token
 * signing/verification is a transport concern handled in the API layer; this
 * service only coordinates the user repository. No business logic.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  /** Register a new account by email (fails if the email already exists). */
  register(email: string): Promise<Result<User>> {
    return this.deps.users.create({ email });
  }

  /** Load an account by id (null when absent). */
  getUser(id: string): Promise<Result<User | null>> {
    return this.deps.users.getById(id);
  }
}
