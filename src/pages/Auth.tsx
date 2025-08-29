import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZegerLogo } from "@/components/ui/zeger-logo";
import iphoneMockup from "@/assets/iphone-mockup.png";
import motorcycleMockup from "@/assets/motorcycle-mockup.png";
import riderMockup from "@/assets/rider-mockup.png";
const cleanupAuthState = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch {
    // ignore
  }
};
const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: ""
  });
  const navigate = useNavigate();
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Clean limbo state then attempt global sign out
      cleanupAuthState();
      try {
        await supabase.auth.signOut({
          scope: 'global'
        });
      } catch {}
      const redirectUrl = `${window.location.origin}/customer-app`;
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            role: "customer"
          }
        }
      });
      if (error) throw error;

      // Create profile after signup
      if (data.user) {
        const {
          error: profileError
        } = await supabase.from('profiles').insert({
          user_id: data.user.id,
          full_name: formData.full_name,
          phone: formData.phone,
          role: "customer",
          branch_id: null
        });
        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      }
      toast.success("Akun customer berhasil dibuat! Silakan login untuk mengakses aplikasi customer.");
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat akun");
    } finally {
      setLoading(false);
    }
  };
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Clean limbo state then attempt global sign out
      cleanupAuthState();
      try {
        await supabase.auth.signOut({
          scope: 'global'
        });
      } catch {}
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      if (error) throw error;
      if (data.user) {
        toast.success("Login berhasil!");
        window.location.href = '/';
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal login");
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-500 to-red-400">
      <div className="flex min-h-screen">
        {/* Left Side - Brand Content */}
        <div className="flex-1 flex flex-col justify-center items-center px-8 lg:px-16 text-white">
          <div className="max-w-lg text-center space-y-8">
            <div className="space-y-4">
              <ZegerLogo size="lg" className="mx-auto" />
              <h1 className="text-5xl font-bold leading-tight">
                A Happiness Coffee<br />
                Everywhere, Anywhere<br />
                Just by Click
              </h1>
            </div>
            
            <p className="text-xl text-white/90 leading-relaxed">
              We deliver a happiness coffee fresh from original Indonesian coffee
            </p>

            {/* 3D Mockups */}
            
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm flex flex-col justify-center px-8 py-12">
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              
            </div>

            <Card className="border-0 shadow-none bg-transparent">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin" className="mt-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-gray-700">Email</Label>
                      <Input id="signin-email" type="email" placeholder="Enter your email" value={formData.email} onChange={e => handleInputChange("email", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-gray-700">Password</Label>
                      <Input id="signin-password" type="password" placeholder="Enter your password" value={formData.password} onChange={e => handleInputChange("password", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" required />
                    </div>
                    <div className="text-right">
                      <a href="#" className="text-sm text-red-600 hover:text-red-700">
                        Forgot Password?
                      </a>
                    </div>
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={loading}>
                      {loading ? "Signing in..." : "Login"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-gray-700">Full Name</Label>
                      <Input id="signup-name" placeholder="Enter your full name" value={formData.full_name} onChange={e => handleInputChange("full_name", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-gray-700">Email</Label>
                      <Input id="signup-email" type="email" placeholder="Enter your email" value={formData.email} onChange={e => handleInputChange("email", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone" className="text-gray-700">Phone Number</Label>
                      <Input id="signup-phone" type="tel" placeholder="Enter your phone number" value={formData.phone} onChange={e => handleInputChange("phone", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-gray-700">Password</Label>
                      <Input id="signup-password" type="password" placeholder="Create a password" value={formData.password} onChange={e => handleInputChange("password", e.target.value)} className="bg-gray-50 border-gray-200 focus:border-red-500 focus:ring-red-500" required />
                    </div>
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={loading}>
                      {loading ? "Creating Account..." : "Sign Up"}
                    </Button>
                    <p className="text-xs text-gray-600 text-center">
                      *Sign up is only available for customers. Employee accounts are managed internally.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>

            <div className="text-center">
              <p className="text-gray-400 text-sm">OR</p>
              <div className="flex space-x-4 mt-4">
                <Button variant="outline" className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
                <Button variant="outline" className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </Button>
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-600 text-sm">
                Don't have an account? <span className="text-red-600 cursor-pointer">Sign Up</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 text-center py-4 bg-red-600/20 backdrop-blur-sm">
        <p className="text-white/80 text-sm">
          Copyright@PT. Zeger Indonesia Grup 2025
        </p>
      </div>
    </div>;
};
export default Auth;