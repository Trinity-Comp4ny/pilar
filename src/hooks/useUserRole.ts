import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'admin' | 'financeiro' | 'marketing' | 'operacional' | 'user';

export const useUserRole = () => {
  return useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[USER_ROLE] No user found');
        return null;
      }

      console.log('[USER_ROLE] Fetching role for user:', user.id);
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('[USER_ROLE] Error fetching role:', error);
        throw error;
      }
      console.log('[USER_ROLE] User role:', data?.role);
      return data?.role as UserRole;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
