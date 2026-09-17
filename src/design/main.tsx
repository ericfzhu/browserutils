import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Shield, Clock, ArrowUpRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../components/ui/dialog';
import { applyTheme } from '../shared/theme';
import { CATEGORY_COLOR_OPTIONS } from '../shared/categories';
import '../styles/index.css';
import './preview.css';

function DesignPreview() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [palette, setPalette] = useState<'monochrome' | 'blue'>('blue');
  React.useEffect(() => applyTheme(mode, palette), [mode, palette]);
  return <div className="min-h-screen p-6 md:p-12">
    <header className="mx-auto mb-10 flex max-w-6xl flex-wrap items-center justify-between gap-6">
      <div><div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><Shield size={18}/> BrowserUtils / Design system</div><h1 className="text-3xl font-semibold tracking-tight">A calmer space to focus.</h1><p className="mt-2 text-muted-foreground">Existing colors. One consistent language for every surface.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setPalette(palette === 'blue' ? 'monochrome' : 'blue')}>{palette === 'blue' ? 'Classic Blue' : 'Monochrome'}</Button><Button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>{mode === 'light' ? 'Dark mode' : 'Light mode'}</Button></div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
      <Card className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">Today’s activity · sample data</p><p className="my-3 text-4xl font-semibold tracking-tight tabular-nums">2h 24m</p></div><Clock className="text-primary"/></div><p className="mb-6 text-sm text-muted-foreground">Time spent in your focused browser window</p><div className="space-y-4">{[['Development','bg-blue-500',72],['Learning','bg-teal-500',48],['Entertainment','bg-purple-500',24]].map(([label,color,width])=><div key={label}><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{width}m</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${color}`} style={{width:`${width}%`}}/></div></div>)}</div><Separator className="my-6"/><div className="flex items-center justify-between"><Badge variant="secondary">Tracking enabled</Badge><Button variant="ghost">Activity history <ArrowUpRight size={16}/></Button></div></Card>
      <Card className="gap-0 space-y-5 p-6"><h2 className="text-lg font-semibold">Controls & preferences</h2><div className="flex items-center justify-between"><Label htmlFor="tracking">Track browsing activity</Label><Switch id="tracking" defaultChecked/></div><div className="flex items-center gap-3"><Checkbox id="idle" defaultChecked/><Label htmlFor="idle">Pause when idle</Label></div><div className="space-y-2"><Label htmlFor="domain">Website</Label><Input id="domain" placeholder="example.com"/></div><div className="space-y-2"><Label htmlFor="disabled">Disabled input</Label><Input id="disabled" disabled value="Managed by focus session" readOnly/></div><div className="space-y-2"><Label htmlFor="invalid">Invalid input</Label><Input id="invalid" aria-invalid defaultValue="not a website"/></div><Select defaultValue="30"><SelectTrigger aria-label="Focus duration" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">60 minutes</SelectItem></SelectContent></Select><Textarea aria-label="Notes" placeholder="Add a note…"/></Card>
      <Card className="gap-0 space-y-5 p-6"><h2 className="text-lg font-semibold">Actions & feedback</h2><div className="flex flex-wrap gap-3"><Button>Start focus</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Delete</Button><Button disabled>Disabled</Button><Button variant="link">View details</Button></div><div className="flex flex-wrap gap-2"><Badge>Active</Badge><Badge variant="secondary">Paused</Badge><Badge variant="outline">Optional</Badge><Badge variant="destructive">Blocked</Badge></div><Alert><AlertTitle>Ready when you are</AlertTitle><AlertDescription>Your preferences are saved on this device.</AlertDescription></Alert><Progress value={65} aria-label="Daily limit usage"/><div className="flex items-center gap-3"><Skeleton className="size-10"/><Skeleton className="h-4 w-40"/></div><Dialog><DialogTrigger asChild><Button variant="outline">Preview dialog</Button></DialogTrigger><DialogContent><DialogTitle>Start a focus session?</DialogTitle><DialogDescription>Your selected sites will stay blocked for 30 minutes.</DialogDescription><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><DialogClose asChild><Button>Start focus</Button></DialogClose></DialogFooter></DialogContent></Dialog></Card>
      <Card className="gap-0 space-y-4 p-6"><h2 className="text-lg font-semibold">Status & data colors</h2>{[['status-success','Preferences saved'],['status-warning','Approaching your daily limit'],['status-danger','This website is blocked'],['status-info','Your next focus session starts at 2pm']].map(([role,label])=><div key={role} className={`rounded-md border p-3 text-sm ${role}`}>{label}</div>)}<p className="pt-2 text-sm text-muted-foreground">Category colors preserve their identity in both modes.</p><div className="flex flex-wrap gap-2">{CATEGORY_COLOR_OPTIONS.map(color=><span key={color} title={color} className={`size-6 rounded ${color}`}/>)}</div><div className="flex gap-2 pt-2">{['swatch-background','swatch-card','swatch-muted','swatch-accent','swatch-primary'].map(role=><div key={role} className="flex-1"><div className={`h-10 rounded border ${role}`}/><p className="mt-2 text-xs text-muted-foreground">{role.replace('swatch-', '')}</p></div>)}</div></Card>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<DesignPreview/>);
