import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import TextArea from '../components/ui/TextArea';
import {
  fetchAdminEmailConfig,
  fetchAdminEmailLogs,
  fetchAdminEmailTemplates,
  previewAdminEmailTemplate,
  testAdminEmailSend,
  updateAdminEmailConfig,
  updateAdminEmailTemplate,
} from '../services/api';

const INITIAL_CONFIG = {
  provider_name: 'smtp',
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_use_tls: true,
  smtp_use_ssl: false,
  from_name: '',
  from_email: '',
  reply_to_email: '',
  is_enabled: false,
};

function AdminEmailPage() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [activeTemplateKey, setActiveTemplateKey] = useState('');
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject_template: '',
    body_html_template: '',
    body_text_template: '',
    variables: '',
    is_active: true,
  });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewVariables, setPreviewVariables] = useState('{"nome":"Cliente","primeiro_nome":"Cliente"}');
  const [previewResult, setPreviewResult] = useState(null);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeTemplate = useMemo(
    () => templates.find((item) => item.key === activeTemplateKey) || null,
    [templates, activeTemplateKey]
  );

  const loadAll = async () => {
    setConfigLoading(true);
    setLogsLoading(true);
    setError('');
    try {
      const [configData, templatesData, logsData] = await Promise.all([
        fetchAdminEmailConfig(),
        fetchAdminEmailTemplates(),
        fetchAdminEmailLogs({ page: 1, page_size: 20 }),
      ]);
      setConfig({
        provider_name: configData?.provider_name || 'smtp',
        smtp_host: configData?.smtp_host || '',
        smtp_port: Number(configData?.smtp_port || 587),
        smtp_username: configData?.smtp_username || '',
        smtp_password: '',
        smtp_use_tls: Boolean(configData?.smtp_use_tls),
        smtp_use_ssl: Boolean(configData?.smtp_use_ssl),
        from_name: configData?.from_name || '',
        from_email: configData?.from_email || '',
        reply_to_email: configData?.reply_to_email || '',
        is_enabled: Boolean(configData?.is_enabled),
      });
      const templateList = Array.isArray(templatesData) ? templatesData : [];
      setTemplates(templateList);
      const firstTemplate = templateList[0] || null;
      const selectedKey = firstTemplate?.key || '';
      setActiveTemplateKey(selectedKey);
      if (firstTemplate) {
        setTemplateForm({
          name: firstTemplate.name || '',
          subject_template: firstTemplate.subject_template || '',
          body_html_template: firstTemplate.body_html_template || '',
          body_text_template: firstTemplate.body_text_template || '',
          variables: (firstTemplate.variables || []).join(', '),
          is_active: Boolean(firstTemplate.is_active),
        });
      }
      setLogs(logsData?.items || []);
    } catch (requestError) {
      setError(requestError.message || 'Falha ao carregar modulo de e-mail.');
    } finally {
      setConfigLoading(false);
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!activeTemplate) return;
    setTemplateForm({
      name: activeTemplate.name || '',
      subject_template: activeTemplate.subject_template || '',
      body_html_template: activeTemplate.body_html_template || '',
      body_text_template: activeTemplate.body_text_template || '',
      variables: (activeTemplate.variables || []).join(', '),
      is_active: Boolean(activeTemplate.is_active),
    });
    setPreviewResult(null);
  }, [activeTemplateKey]);

  const handleConfigSave = async (event) => {
    event.preventDefault();
    setConfigSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await updateAdminEmailConfig(config);
      setConfig((current) => ({
        ...current,
        smtp_password: '',
        provider_name: data?.provider_name || current.provider_name,
        smtp_host: data?.smtp_host || '',
        smtp_port: Number(data?.smtp_port || 587),
        smtp_username: data?.smtp_username || '',
        smtp_use_tls: Boolean(data?.smtp_use_tls),
        smtp_use_ssl: Boolean(data?.smtp_use_ssl),
        from_name: data?.from_name || '',
        from_email: data?.from_email || '',
        reply_to_email: data?.reply_to_email || '',
        is_enabled: Boolean(data?.is_enabled),
      }));
      setMessage('Configuracao de e-mail salva com sucesso.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar configuracao de e-mail.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      setError('Informe um e-mail para teste.');
      return;
    }
    setTestLoading(true);
    setMessage('');
    setError('');
    try {
      const result = await testAdminEmailSend({ recipient_email: testEmail.trim() });
      if (result?.ok) {
        setMessage(result?.message || 'E-mail de teste enviado com sucesso.');
        const logsData = await fetchAdminEmailLogs({ page: 1, page_size: 20 });
        setLogs(logsData?.items || []);
      } else {
        setError(result?.message || 'Falha no envio de teste.');
      }
    } catch (testError) {
      setError(testError.message || 'Falha ao enviar e-mail de teste.');
    } finally {
      setTestLoading(false);
    }
  };

  const handleTemplateSave = async (event) => {
    event.preventDefault();
    if (!activeTemplateKey) {
      setError('Selecione um template para editar.');
      return;
    }
    setTemplateSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        name: templateForm.name,
        subject_template: templateForm.subject_template,
        body_html_template: templateForm.body_html_template,
        body_text_template: templateForm.body_text_template,
        variables: templateForm.variables
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        is_active: templateForm.is_active,
      };
      const updated = await updateAdminEmailTemplate(activeTemplateKey, payload);
      setTemplates((current) => current.map((item) => (item.key === updated.key ? updated : item)));
      setMessage('Template salvo com sucesso.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!activeTemplateKey) return;
    setPreviewLoading(true);
    setError('');
    setMessage('');
    try {
      const parsed = previewVariables.trim() ? JSON.parse(previewVariables) : {};
      const result = await previewAdminEmailTemplate(activeTemplateKey, { variables: parsed });
      setPreviewResult(result);
    } catch (previewError) {
      setError(previewError.message || 'Falha ao gerar preview do template.');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Comunicacao"
        title="E-mail"
        subtitle="Configure SMTP, gerencie templates com variaveis e acompanhe o historico de envios."
      />

      <DataCard title="Configuracao SMTP">
        {configLoading ? <p className="text-sm text-slate-500">Carregando configuracao...</p> : null}
        {!configLoading ? (
          <form className="grid max-w-3xl gap-3" onSubmit={handleConfigSave}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Provider" value={config.provider_name} onChange={(event) => setConfig((current) => ({ ...current, provider_name: event.target.value }))} />
              <Input label="SMTP Host" value={config.smtp_host} onChange={(event) => setConfig((current) => ({ ...current, smtp_host: event.target.value }))} />
              <Input label="SMTP Port" type="number" value={config.smtp_port} onChange={(event) => setConfig((current) => ({ ...current, smtp_port: Number(event.target.value || 0) }))} />
              <Input label="SMTP Usuario" value={config.smtp_username} onChange={(event) => setConfig((current) => ({ ...current, smtp_username: event.target.value }))} />
              <Input label="SMTP Senha (somente para atualizar)" type="password" value={config.smtp_password} onChange={(event) => setConfig((current) => ({ ...current, smtp_password: event.target.value }))} />
              <Input label="Nome remetente" value={config.from_name} onChange={(event) => setConfig((current) => ({ ...current, from_name: event.target.value }))} />
              <Input label="E-mail remetente" value={config.from_email} onChange={(event) => setConfig((current) => ({ ...current, from_email: event.target.value }))} />
              <Input label="Reply-to" value={config.reply_to_email} onChange={(event) => setConfig((current) => ({ ...current, reply_to_email: event.target.value }))} />
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={config.smtp_use_tls} onChange={(event) => setConfig((current) => ({ ...current, smtp_use_tls: event.target.checked }))} />
                Usar TLS
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={config.smtp_use_ssl} onChange={(event) => setConfig((current) => ({ ...current, smtp_use_ssl: event.target.checked }))} />
                Usar SSL
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={config.is_enabled} onChange={(event) => setConfig((current) => ({ ...current, is_enabled: event.target.checked }))} />
                Habilitar envio de e-mails
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={configSaving}>Salvar configuracao</Button>
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-[250px]" label="E-mail de teste" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="teste@exemplo.com" />
                <Button type="button" variant="secondary" loading={testLoading} onClick={handleTestSend}>Enviar teste</Button>
              </div>
            </div>
          </form>
        ) : null}
      </DataCard>

      <DataCard title="Templates">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => setActiveTemplateKey(template.key)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${activeTemplateKey === template.key ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                <p className="font-semibold">{template.name}</p>
                <p className="text-xs opacity-80">{template.key}</p>
              </button>
            ))}
          </div>

          <form className="grid gap-3" onSubmit={handleTemplateSave}>
            <Input label="Nome" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
            <Input label="Assunto" value={templateForm.subject_template} onChange={(event) => setTemplateForm((current) => ({ ...current, subject_template: event.target.value }))} />
            <Input label="Variaveis (separadas por virgula)" value={templateForm.variables} onChange={(event) => setTemplateForm((current) => ({ ...current, variables: event.target.value }))} placeholder="nome, primeiro_nome, order_id" />
            <TextArea label="Body HTML" value={templateForm.body_html_template} onChange={(event) => setTemplateForm((current) => ({ ...current, body_html_template: event.target.value }))} />
            <TextArea label="Body texto (opcional)" value={templateForm.body_text_template} onChange={(event) => setTemplateForm((current) => ({ ...current, body_text_template: event.target.value }))} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={templateForm.is_active} onChange={(event) => setTemplateForm((current) => ({ ...current, is_active: event.target.checked }))} />
              Template ativo
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={templateSaving}>Salvar template</Button>
              <Button type="button" variant="secondary" loading={previewLoading} onClick={handlePreview}>Gerar preview</Button>
            </div>

            <TextArea label="Variaveis para preview (JSON)" value={previewVariables} onChange={(event) => setPreviewVariables(event.target.value)} className="max-w-3xl" />
            {previewResult ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p><strong>Assunto renderizado:</strong> {previewResult.subject_rendered || '-'}</p>
                {previewResult.missing_variables?.length ? (
                  <p className="mt-1 text-amber-700"><strong>Variaveis ausentes:</strong> {previewResult.missing_variables.join(', ')}</p>
                ) : null}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Body texto</p>
                <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">{previewResult.body_text_rendered || '-'}</pre>
              </div>
            ) : null}
          </form>
        </div>
      </DataCard>

      <DataCard title="Historico de envios">
        {logsLoading ? <p className="text-sm text-slate-500">Carregando historico...</p> : null}
        {!logsLoading ? (
          <div className="table-wrap">
            <table className="table-pro min-w-[860px]">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Destinatario</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Assunto</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.length ? logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}</td>
                    <td>{log.recipient_email}</td>
                    <td>{log.template_key || '-'}</td>
                    <td>{log.status}</td>
                    <td>{log.subject_rendered}</td>
                    <td>{log.error_message || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500">Nenhum envio registrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </DataCard>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}

export default AdminEmailPage;
