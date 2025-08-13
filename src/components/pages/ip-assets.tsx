"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Library, Upload, FileText, Edit, Trash2 } from "lucide-react";
import { useTauri } from "@/hooks/use-tauri";
import type { IpAsset } from "@/lib/tauri-api";

const workTypes = ["视频", "音乐", "图片", "文章", "软件", "其他"];
const regions = ["中国大陆", "香港", "澳门", "台湾", "美国", "日本", "韩国", "其他"];
const equityTypes = ["著作权", "商标权", "专利权", "其他"];

const initialFormState: Omit<IpAsset, 'id' | 'createdAt' | 'updatedAt'> = {
  isAgent: false,
  owner: "",
  authStartDate: "",
  authEndDate: "",
  authFiles: [],
  equityType: "著作权",
  workType: "",
  workName: "",
  region: "中国大陆",
  workStartDate: "",
  workEndDate: "",
  workProofFiles: [],
  status: "待认证"
};

export function IpAssetsPage() {
  const { tauriAPI, isReady } = useTauri();
  const [ipAssets, setIpAssets] = useState<IpAsset[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<IpAsset | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState(initialFormState);
  
  const loadAssets = async () => {
    setLoading(true);
    try {
      const assets = await tauriAPI.getIpAssets();
      setIpAssets(assets);
    } catch (error) {
      console.error("Failed to load IP assets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      loadAssets();
    }
  }, [isReady]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (editingAsset) {
        await tauriAPI.saveIpAsset({ ...formData, id: editingAsset.id });
      } else {
        await tauriAPI.saveIpAsset(formData);
      }
      await tauriAPI.showMessage("成功", editingAsset ? "IP资产已更新！" : "IP资产已添加！");
      await loadAssets();
      setIsDialogOpen(false);
    } catch (error) {
      await tauriAPI.showMessage("错误", "保存失败");
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
  };

  const handleEdit = (asset: IpAsset) => {
    setEditingAsset(asset);
    setFormData({
      ...asset,
      authFiles: asset.authFiles ? JSON.parse(asset.authFiles as any) : [],
      workProofFiles: asset.workProofFiles ? JSON.parse(asset.workProofFiles as any) : []
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("确定要删除这个IP资产吗？")) {
        try {
            await tauriAPI.deleteIpAsset(id);
            await tauriAPI.showMessage("成功", "IP资产已删除！");
            await loadAssets();
        } catch (error) {
            await tauriAPI.showMessage("错误", "删除失败");
        }
    }
  };

  const handleFileSelect = async (type: 'auth' | 'proof') => {
    try {
        const selection = await tauriAPI.selectFiles();
        if (selection.paths.length > 0) {
            const field = type === 'auth' ? 'authFiles' : 'workProofFiles';
            setFormData(prev => ({
                ...prev,
                [field]: [...(prev[field] || []), ...selection.paths]
            }));
        }
    } catch (error) {
        console.error("File selection error:", error);
        await tauriAPI.showMessage("错误", "文件选择失败");
    }
  };
  
  if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IP资产库</h1>
          <p className="text-muted-foreground">
            管理您的知识产权作品，用于自动化申诉流程
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingAsset(null);
              resetForm();
              setIsDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              新增IP资产
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAsset ? "编辑IP资产" : "新增IP资产"}</DialogTitle>
              <DialogDescription>填写IP资产的详细信息，用于权益认证步骤</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Form fields... (same as original, no changes needed here) */}
               {/* Is Agent */}
               <div className="space-y-2">
                <Label>身份类型</Label>
                <RadioGroup 
                  value={formData.isAgent ? "agent" : "owner"} 
                  onValueChange={(value) => handleInputChange("isAgent", value === "agent")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="owner" id="owner" />
                    <Label htmlFor="owner">权利人</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="agent" id="agent" />
                    <Label htmlFor="agent">代理人</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Owner */}
              <div className="space-y-2">
                <Label htmlFor="owner">权利人 *</Label>
                <Input
                  id="owner"
                  placeholder="权利人姓名或机构名称"
                  value={formData.owner}
                  onChange={(e) => handleInputChange("owner", e.target.value)}
                />
              </div>

              {/* Auth Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>授权期限（起始）</Label>
                  <Input
                    type="date"
                    value={formData.authStartDate}
                    onChange={(e) => handleInputChange("authStartDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>授权期限（结束）</Label>
                  <Input
                    type="date"
                    value={formData.authEndDate}
                    onChange={(e) => handleInputChange("authEndDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Auth Files */}
              <div className="space-y-2">
                <Label>授权证明</Label>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">授权合同等证明文件</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFileSelect('auth')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    选择文件
                  </Button>
                </div>
              </div>

              {/* Equity Type */}
              <div className="space-y-2">
                <Label>权益类型</Label>
                <RadioGroup 
                  value={formData.equityType} 
                  onValueChange={(value) => handleInputChange("equityType", value)}
                >
                  {equityTypes.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <RadioGroupItem value={type} id={type} />
                      <Label htmlFor={type}>{type}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Work Type */}
              <div className="space-y-2">
                <Label>著作类型 *</Label>
                <Select value={formData.workType} onValueChange={(value) => handleInputChange("workType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择著作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {workTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work Name */}
              <div className="space-y-2">
                <Label htmlFor="workName">著作名称 *</Label>
                <Input
                  id="workName"
                  placeholder="作品名称"
                  value={formData.workName}
                  onChange={(e) => handleInputChange("workName", e.target.value)}
                />
              </div>

              {/* Region */}
              <div className="space-y-2">
                <Label>地区</Label>
                <Select value={formData.region} onValueChange={(value) => handleInputChange("region", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work Period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>期限（起始）</Label>
                  <Input
                    type="date"
                    value={formData.workStartDate}
                    onChange={(e) => handleInputChange("workStartDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>期限（结束）</Label>
                  <Input
                    type="date"
                    value={formData.workEndDate}
                    onChange={(e) => handleInputChange("workEndDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Work Proof Files */}
              <div className="space-y-2">
                <Label>证明</Label>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">版权登记证书等证明文件</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFileSelect('proof')}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    选择文件
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} className="flex-1">{editingAsset ? "更新" : "添加"}</Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">取消</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Library className="h-5 w-5" /> IP资产列表</CardTitle>
          <CardDescription>管理您的知识产权作品</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>著作名称</TableHead>
                <TableHead>著作类型</TableHead>
                <TableHead>权利人</TableHead>
                <TableHead>地区</TableHead>
                <TableHead>权益类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.workName}</TableCell>
                  <TableCell>{asset.workType}</TableCell>
                  <TableCell>{asset.owner}</TableCell>
                  <TableCell>{asset.region}</TableCell>
                  <TableCell>{asset.equityType}</TableCell>
                  <TableCell>
                    <Badge variant={asset.status === "已认证" ? "default" : "secondary"}>{asset.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(asset)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(asset.id!)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}