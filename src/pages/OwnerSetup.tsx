import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bot, Mail, Shield, Play, Square, RefreshCw } from "lucide-react";

interface BotSettings {
  telegram_bot_token: string;
  telegram_owner_id: string;
  outlook_email: string;
  outlook_password: string;
  polling_interval_minutes: number;
  email_filter: string;
  is_active: boolean;
}

export default function OwnerSetup() {
  const [ownerSecret, setOwnerSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  const [settings, setSettings] = useState<BotSettings>({
    telegram_bot_token: "",
    telegram_owner_id: "",
    outlook_email: "",
    outlook_password: "",
    polling_interval_minutes: 1,
    email_filter: "OTP",
    is_active: false,
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/get-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_secret: ownerSecret }),
      });

      const data = await response.json();

      if (response.ok && data.settings) {
        setIsAuthenticated(true);
        setSettings({
          telegram_bot_token: "",
          telegram_owner_id: data.settings.telegram_owner_id || "",
          outlook_email: data.settings.outlook_email || "",
          outlook_password: "",
          polling_interval_minutes: data.settings.polling_interval_minutes || 1,
          email_filter: data.settings.email_filter || "OTP",
          is_active: data.settings.is_active || false,
        });
        toast({ title: "Login berhasil" });
      } else {
        toast({ title: "Owner secret salah", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error connecting to server", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData: Record<string, any> = {
        owner_secret: ownerSecret,
        telegram_owner_id: settings.telegram_owner_id,
        outlook_email: settings.outlook_email,
        polling_interval_minutes: settings.polling_interval_minutes,
        email_filter: settings.email_filter,
        is_active: settings.is_active,
      };

      // Only include if changed
      if (settings.telegram_bot_token) {
        updateData.telegram_bot_token = settings.telegram_bot_token;
      }
      if (settings.outlook_password) {
        updateData.outlook_password = settings.outlook_password;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/update-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({ title: "Settings saved successfully" });
        // Clear password fields after save
        setSettings(prev => ({
          ...prev,
          telegram_bot_token: "",
          outlook_password: "",
        }));
      } else {
        toast({ title: data.error || "Failed to save", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error saving settings", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: "Email check completed", 
          description: `Processed ${data.processed || 0} emails` 
        });
      } else {
        toast({ title: data.error || "Test failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error testing email", variant: "destructive" });
    }
    setIsTesting(false);
  };

  const handleCleanup = async () => {
    setIsTesting(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/cleanup-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok) {
        toast({ 
          title: "Cleanup completed", 
          description: `Deleted ${data.deleted || 0} messages` 
        });
      } else {
        toast({ title: data.error || "Cleanup failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error running cleanup", variant: "destructive" });
    }
    setIsTesting(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Owner Access</CardTitle>
            <CardDescription>
              Masukkan owner secret untuk mengakses pengaturan bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret">Owner Secret</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Masukkan secret..."
                value={ownerSecret}
                onChange={(e) => setOwnerSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleLogin}
              disabled={isLoading || !ownerSecret}
            >
              {isLoading ? "Loading..." : "Login"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bot Settings</h1>
            <p className="text-muted-foreground">Konfigurasi Telegram Email Notifier</p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Status Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${settings.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span>{settings.is_active ? "Aktif" : "Nonaktif"}</span>
            </div>
            <Switch
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
            />
          </CardContent>
        </Card>

        {/* Telegram Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Telegram Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot_token">Bot Token</Label>
              <Input
                id="bot_token"
                type="password"
                placeholder="Kosongkan jika tidak ingin mengubah"
                value={settings.telegram_bot_token}
                onChange={(e) => setSettings(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Dapatkan dari @BotFather di Telegram</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_id">Owner Chat ID</Label>
              <Input
                id="owner_id"
                placeholder="123456789"
                value={settings.telegram_owner_id}
                onChange={(e) => setSettings(prev => ({ ...prev, telegram_owner_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Chat ID Anda (dapatkan dari @userinfobot)</p>
            </div>
          </CardContent>
        </Card>

        {/* Outlook Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Outlook Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="yourmail@outlook.com"
                value={settings.outlook_email}
                onChange={(e) => setSettings(prev => ({ ...prev, outlook_email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password / App Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Kosongkan jika tidak ingin mengubah"
                value={settings.outlook_password}
                onChange={(e) => setSettings(prev => ({ ...prev, outlook_password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Gunakan App Password jika 2FA aktif</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter">Email Filter (Subject Contains)</Label>
              <Input
                id="filter"
                placeholder="OTP"
                value={settings.email_filter}
                onChange={(e) => setSettings(prev => ({ ...prev, email_filter: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Hanya forward email yang subject mengandung kata ini</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">Polling Interval (menit)</Label>
              <Input
                id="interval"
                type="number"
                min={1}
                max={60}
                value={settings.polling_interval_minutes}
                onChange={(e) => setSettings(prev => ({ ...prev, polling_interval_minutes: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSave} disabled={isLoading} className="flex-1">
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleTestEmail} 
            disabled={isTesting}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isTesting ? "Testing..." : "Test Check Email"}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCleanup} 
            disabled={isTesting}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Cleanup
          </Button>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Note: Untuk polling otomatis setiap menit, Anda perlu setup cron job di server yang memanggil endpoint /check-email
        </p>
      </div>
    </div>
  );
}
