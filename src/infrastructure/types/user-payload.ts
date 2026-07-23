export interface IUserPayload {
    id: string;
    email: string;
    isAdmin: boolean;
    role: 'admin' | 'user' | 'member';
    iat?: number;  // issued at
    exp?: number;  // expiration
}