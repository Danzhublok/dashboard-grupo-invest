import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Pencil, Save, Trash2, UserPlus, X } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore, type RepresentativeCredentials } from "@/lib/store";

export const Route = createFileRoute("/usuarios")({ component: Usuarios });

function Usuarios() {
  const { dados, usuarios, criarUsuario, alterarSenhaUsuario, deleteUsuario } = useStore();
  const [representationId, setRepresentationId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [credentials, setCredentials] = useState<RepresentativeCredentials | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [showEditingPassword, setShowEditingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const createUser = async () => {
    setCreating(true);
    setCredentials(null);
    const result = await criarUsuario(representationId, username, password);
    setCredentials(result);
    setCreating(false);
    if (result) {
      setUsername("");
      setPassword("");
    }
  };

  return (
    <AppLayout title="Usuários dos representantes">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Crie um acesso e vincule o representante à representação correta.
          </p>
        </div>

        <Card className="surface-card border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" /> Novo usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="usuario-representacao">Representação</Label>
              <select
                id="usuario-representacao"
                value={representationId}
                onChange={(event) => setRepresentationId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione uma representação</option>
                {dados.representacoes.map((representation) => (
                  <option key={representation.id} value={representation.id}>
                    {representation.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-usuario">Usuário</Label>
              <Input
                id="novo-usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Ex.: reinaldo"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Senha</Label>
              <div className="relative">
                <Input
                  id="nova-senha"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ex.: romarepresent"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={() => void createUser()}
                disabled={!representationId || !username.trim() || password.length < 8 || creating}
              >
                <KeyRound className="size-4" />
                {creating ? "Criando acesso..." : "Criar login"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                A senha precisa ter pelo menos 8 caracteres e não será salva em texto no banco.
              </p>
            </div>
          </CardContent>
        </Card>

        {credentials && (
          <Card className="border-accent/40 bg-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="size-5" /> Login criado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Entregue estas credenciais ao representante. Elas não serão exibidas novamente.</p>
              <p>
                <strong>Usuário:</strong> {credentials.username}
              </p>
              <p>
                <strong>Senha:</strong> {credentials.password}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="surface-card border-border/60">
          <CardHeader>
            <CardTitle>Logins cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {usuarios.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
            ) : (
              usuarios.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex-1">
                    <p className="font-medium">{user.username || user.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.role === "admin"
                        ? "Administrador"
                        : user.representationName || "Sem representação"}
                    </p>
                  </div>
                  {user.role !== "admin" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar senha de ${user.username || user.nome}`}
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditingPassword("");
                          setShowEditingPassword(false);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir usuário ${user.username || user.nome}`}
                        onClick={() => {
                          if (window.confirm(`Excluir o usuário ${user.username || user.nome}?`))
                            void deleteUsuario(user.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                  {editingUserId === user.id && (
                    <div className="flex basis-full items-end gap-2 border-t border-border/60 pt-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor={`senha-${user.id}`}>Nova senha</Label>
                        <div className="relative">
                          <Input
                            id={`senha-${user.id}`}
                            type={showEditingPassword ? "text" : "password"}
                            value={editingPassword}
                            onChange={(event) => setEditingPassword(event.target.value)}
                            placeholder="Mínimo de 8 caracteres"
                            autoComplete="new-password"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0"
                            aria-label={showEditingPassword ? "Ocultar senha" : "Exibir senha"}
                            onClick={() => setShowEditingPassword((current) => !current)}
                          >
                            {showEditingPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        aria-label="Salvar nova senha"
                        disabled={editingPassword.length < 8 || savingPassword}
                        onClick={async () => {
                          setSavingPassword(true);
                          const saved = await alterarSenhaUsuario(user.id, editingPassword);
                          setSavingPassword(false);
                          if (saved) {
                            setEditingUserId(null);
                            setEditingPassword("");
                          }
                        }}
                      >
                        <Save className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Cancelar edição da senha"
                        onClick={() => setEditingUserId(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
