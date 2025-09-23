import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const CreateMalangBranch = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const createBranchAndAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-malang-branch');
      
      if (error) {
        console.error('Error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create branch and accounts",
          variant: "destructive"
        });
        return;
      }

      setResult(data);
      toast({
        title: "Success",
        description: "Malang branch and accounts created successfully!",
      });
    } catch (error: any) {
      console.error('Exception:', error);
      toast({
        title: "Error", 
        description: error.message || "Failed to create branch and accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Zeger Branch Hub Malang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>This will create:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Zeger Branch Hub Malang branch</li>
            <li>Bu Fitria Setyaningrum (Hub_Branch Manager) - setyaningrumfitria@gmail.com</li>
            <li>Pak Alut Z-009 (Hub_Rider) - ZegerOTW09@gmail.com</li>
            <li>Pak Agung Z-015 (Hub_Rider) - purnomoagungwibowo24@gmail.com</li>
          </ul>
          
          <Button 
            onClick={createBranchAndAccounts} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Branch & Accounts'}
          </Button>

          {result && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateMalangBranch;