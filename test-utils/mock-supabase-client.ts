// test-utils/mock-supabase-client.ts

export const mockSupabaseClient = {
  auth: {
    getUser: async () => ({
      data: {
        user: {
          id: "test_user_auth_id",
          email: "test@example.com",
          user_metadata: {
            userId: "test_user_1",
          },
        },
      },
      error: null,
    }),

    getSession: async () => ({
      data: {
        session: {
          access_token: "mock_access_token",
          user: {
            id: "test_user_auth_id",
            email: "test@example.com",
          },
        },
      },
      error: null,
    }),

    signInWithPassword: async () => ({
      data: {
        user: {
          id: "test_user_auth_id",
          email: "test@example.com",
        },
        session: {
          access_token: "mock_access_token",
        },
      },
      error: null,
    }),

    signOut: async () => ({
      error: null,
    }),
  },

  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: "test_record_id",
            name: "Test Record",
          },
          error: null,
        }),
      }),
    }),

    insert: () => ({
      select: async () => ({
        data: [
          {
            id: "test_record_id",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
    }),

    update: () => ({
      eq: () => ({
        select: async () => ({
          data: [
            {
              id: "test_record_id",
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      }),
    }),

    delete: () => ({
      eq: async () => ({
        data: null,
        error: null,
      }),
    }),
  }),
};

// Mock createClient function
export const createClient = (url: string, key: string) => {
  console.log(`✅ Mock Supabase client created for ${url}`);
  return mockSupabaseClient;
};
