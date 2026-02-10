import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    isAdmin?: boolean
    capabilities?: string[]
    role?: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isAdmin?: boolean
      capabilities?: string[]
      role?: string
    }
  }
}
