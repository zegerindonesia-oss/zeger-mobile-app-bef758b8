import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useRiderFilter = () => {
  const { userProfile } = useAuth();
  const [assignedRiderId, setAssignedRiderId] = useState<string | null>(null);
  const [assignedRiderName, setAssignedRiderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.role === 'bh_report' && userProfile.id) {
      console.log('🔍 BH Report user detected, fetching assigned rider for:', userProfile.full_name);
      fetchAssignedRider();
    }
  }, [userProfile]);

  const fetchAssignedRider = async () => {
    if (!userProfile?.id) {
      console.log('❌ No userProfile.id available');
      return;
    }
    
    console.log('🚀 Starting fetchAssignedRider for user:', userProfile.full_name, 'ID:', userProfile.id);
    setLoading(true);
    setError(null);
    
    try {
      // First get the assignment
      const { data: assignments, error: assignmentError } = await supabase
        .from('branch_hub_report_assignments')
        .select('rider_id, user_id')
        .eq('user_id', userProfile.id);

      console.log('📊 Assignment query result:', { assignments, error: assignmentError });

      if (assignmentError) {
        console.error('❌ Error fetching assigned rider:', assignmentError);
        setError(`Database error: ${assignmentError.message}`);
        return;
      }

      if (assignments && assignments.length > 0) {
        const assignment = assignments[0];
        const riderId = assignment.rider_id;
        
        console.log('✅ Assignment found, rider_id:', riderId);
        
        if (riderId) {
          // Now fetch the rider profile separately
          const { data: riderProfile, error: riderError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', riderId)
            .single();

          console.log('👤 Rider profile query result:', { riderProfile, error: riderError });

          if (riderError) {
            console.error('❌ Error fetching rider profile:', riderError);
            setError(`Error fetching rider profile: ${riderError.message}`);
            return;
          }

          if (riderProfile) {
            console.log('🎯 Setting assigned rider:', riderProfile.full_name, 'ID:', riderProfile.id);
            setAssignedRiderId(riderProfile.id);
            setAssignedRiderName(riderProfile.full_name);
          } else {
            console.log('❌ No rider profile found');
            setError('Rider profile not found');
          }
        } else {
          console.log('❌ No rider_id in assignment');
          setError('Invalid assignment: no rider_id');
        }
      } else {
        console.log('❌ No assignments found for user:', userProfile.full_name);
        setError('No rider assignment found for this user');
      }
    } catch (error: any) {
      console.error('❌ Exception in fetchAssignedRider:', error);
      setError(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const shouldAutoFilter = userProfile?.role === 'bh_report' && assignedRiderId;

  return {
    assignedRiderId,
    assignedRiderName,
    shouldAutoFilter,
    loading,
    error,
    refreshAssignment: fetchAssignedRider
  };
};