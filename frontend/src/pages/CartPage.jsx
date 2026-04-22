import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import { WHATSAPP_NUMBER } from '../config/endpoints';
import {
  createInfinitePayCheckout,
  createOrder,
  fetchPublicLogo,
  fetchPublicSettings,
  resolveAssetUrl,
  trackEvent,
} from '../services/api';
import { getLogoSizeConfig, getLogoSizeKey } from '../services/logoSettings';
import { useCart } from '../services/cart';

function ColorPreview({ primary, secondary, size = 16 }) {
  const normalizedPrimary = String(primary || '').trim();
  const normalizedSecondary = String(secondary || '').trim();
  if (!normalizedPrimary && !normalizedSecondary) return null;

  const hasSecondary = Boolean(normalizedSecondary);
  const style = hasSecondary
    ? { background: `linear-gradient(90deg, ${normalizedPrimary || '#ffffff'} 0 50%, ${normalizedSecondary} 50% 100%)` }
    : { backgroundColor: normalizedPrimary || normalizedSecondary };

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block rounded-full border border-slate-300" style={{ width: size, height: size, ...style }} />
      <span>{hasSecondary ? 'Cor + furta cor' : 'Cor principal'}</span>
    </span>
  );
}

function CheckoutOptionCard({
  accent = 'violet',
  icon,
  title,
  description,
  benefits = [],
  selected = false,
  onSelect,
}) {
  const tone = accent === 'green'
    ? {
      card: selected
        ? 'border-emerald-300 bg-emerald-50/70 shadow-[0_12px_32px_-24px_rgba(16,185,129,0.8)]'
        : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-[0_12px_32px_-24px_rgba(16,185,129,0.6)]',
      icon: 'bg-emerald-100 text-emerald-700',
      bullet: 'bg-emerald-500',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
    : {
      card: selected
        ? 'border-violet-300 bg-violet-50/70 shadow-[0_12px_32px_-24px_rgba(124,58,237,0.8)]'
        : 'border-slate-200 bg-white hover:border-violet-200 hover:shadow-[0_12px_32px_-24px_rgba(124,58,237,0.6)]',
      icon: 'bg-violet-100 text-violet-700',
      bullet: 'bg-violet-500',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
    };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`rounded-2xl border p-4 transition-all duration-200 ${tone.card}`.trim()}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone.icon}`.trim()}>
          {icon}
        </div>
        {selected ? <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`.trim()}>Ativo</span> : null}
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
      <ul className="mt-3 space-y-2 text-xs text-slate-700">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2">
            <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${tone.bullet}`.trim()} />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    coupon,
    couponMessage,
    applyCoupon,
    subtotal,
    discount,
    total,
    clearCart,
  } = useCart();
  const [code, setCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedCheckoutOption, setSelectedCheckoutOption] = useState('online');
  const [storeSettings, setStoreSettings] = useState({ whatsapp_number: '', pix_key: '' });
  const navigate = useNavigate();

  const getItemPrice = (item) => Number(item.unit_price ?? item.final_price ?? item.price ?? 0);
  const getItemLeadHours = (item) => {
    const baseHours = Number(item.lead_time_hours ?? 0);
    const subItemsHours = (item.selected_sub_items || []).reduce(
      (sum, subItem) => sum + Number(subItem.lead_time_hours ?? 0) * Number(subItem.quantity ?? 0),
      0
    );
    return baseHours + subItemsHours;
  };
  const getDaysFromHours = (hours) => {
    const safeHours = Math.max(0, Number(hours || 0));
    if (safeHours <= 0) return 1;
    return Math.max(1, Math.ceil(safeHours / 24));
  };
  const getLineLeadHours = (item) => getItemLeadHours(item) * Number(item.quantity || 1);
  const totalLeadHours = items.reduce((sum, item) => sum + getLineLeadHours(item), 0);
  const totalLeadDays = getDaysFromHours(totalLeadHours);
  const formatColors = (primary, secondary) => {
    const values = [primary, secondary].filter(Boolean);
    if (!values.length) return null;
    return values.join(' + ');
  };
  const getNamePersonalizations = (item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const values = Array.isArray(item.name_personalizations)
      ? item.name_personalizations.map((value) => String(value || '').trim())
      : [];
    const next = values.slice(0, quantity);
    while (next.length < quantity) next.push('');
    return next;
  };

  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const getCartItemKey = (item) => item.cart_key || `${item.slug}::base`;

  useEffect(() => {
    fetchPublicSettings()
      .then((data) => {
        setStoreSettings({
          whatsapp_number: data?.whatsapp_number || '',
          pix_key: data?.pix_key || '',
        });
      })
      .catch(() => {
        setStoreSettings({ whatsapp_number: '', pix_key: '' });
      });
  }, []);

  const whatsappNumber = useMemo(() => {
    const configured = String(storeSettings.whatsapp_number || '').trim();
    if (configured) return configured.replace(/[^\d+]/g, '');
    return String(WHATSAPP_NUMBER || '').trim().replace(/[^\d+]/g, '');
  }, [storeSettings.whatsapp_number]);

  const fileToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const loadLogoData = async () => {
    const logo = await fetchPublicLogo().catch(() => null);
    const logoUrl = resolveAssetUrl(logo?.url);
    if (!logoUrl) return null;

    try {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await fileToDataUrl(blob);
      const format = dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
      return { dataUrl, format };
    } catch {
      return null;
    }
  };

  const getImageDimensions = (dataUrl) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      img.onerror = () => resolve({ width: 1, height: 1 });
      img.src = dataUrl;
    });

  const handleDownloadQuotePdf = async () => {
    if (!items.length) return;
    setPdfLoading(true);

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const left = 48;
      const right = pageWidth - 48;
      let y = 44;

      const logoData = await loadLogoData();
      const logoSize = getLogoSizeConfig(getLogoSizeKey());
      if (logoData?.dataUrl) {
        const { width: naturalWidth, height: naturalHeight } = await getImageDimensions(logoData.dataUrl);
        const widthRatio = logoSize.pdfMaxWidth / naturalWidth;
        const heightRatio = logoSize.pdfMaxHeight / naturalHeight;
        const ratio = Math.min(widthRatio, heightRatio);
        const drawWidth = Math.max(90, naturalWidth * ratio);
        const drawHeight = Math.max(26, naturalHeight * ratio);

        doc.addImage(
          logoData.dataUrl,
          logoData.format,
          left,
          y,
          drawWidth,
          drawHeight,
          undefined,
          'FAST'
        );
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('PLA Studio', left, y + 24);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Orcamento', right, y + 16, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, right, y + 34, { align: 'right' });

      y += 62;
      doc.setDrawColor(229, 231, 235);
      doc.line(left, y, right, y);
      y += 20;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(left, y, right - left, 26, 6, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text('Item', left + 12, y + 17);
      doc.text('Qtd', right - 170, y + 17, { align: 'right' });
      doc.text('Unitario', right - 90, y + 17, { align: 'right' });
      doc.text('Total', right - 12, y + 17, { align: 'right' });
      y += 38;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(10);

      items.forEach((item) => {
        const unitPrice = getItemPrice(item);
        const lineTotal = unitPrice * item.quantity;
        const selectedSubItems = item.selected_sub_items || [];
        const deliveryDays = getDaysFromHours(getLineLeadHours(item));
        const selectedSubItemsText = selectedSubItems.length
          ? ` (${selectedSubItems.map((subItem) => `${subItem.quantity}x ${subItem.title}`).join(', ')})`
          : '';
        const colorLabel = formatColors(item.selected_color, item.selected_secondary_color);
        const names = getNamePersonalizations(item).filter(Boolean);
        const namesText = names.length ? ` | Textos: ${names.join(', ')}` : '';
        const subtitle = colorLabel
          ? ` | Cores: ${colorLabel}${namesText} | Entrega: ${deliveryDays} dia(s)`
          : `${namesText} | Entrega: ${deliveryDays} dia(s)`;
        const titleLines = doc.splitTextToSize(`${item.title}${selectedSubItemsText}${subtitle}`, 250);
        const rowHeight = Math.max(22, titleLines.length * 12);

        doc.text(titleLines, left + 12, y);
        doc.text(String(item.quantity), right - 170, y, { align: 'right' });
        doc.text(formatBRL(unitPrice), right - 90, y, { align: 'right' });
        doc.text(formatBRL(lineTotal), right - 12, y, { align: 'right' });

        y += rowHeight;
        doc.setDrawColor(241, 245, 249);
        doc.line(left, y + 4, right, y + 4);
        y += 16;
      });

      const summaryWidth = 220;
      const summaryX = right - summaryWidth;
      y += 4;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(summaryX, y, summaryWidth, 78, 8, 8, 'F');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Subtotal', summaryX + 12, y + 20);
      doc.text(formatBRL(subtotal), right - 12, y + 20, { align: 'right' });
      doc.text('Desconto', summaryX + 12, y + 38);
      doc.text(formatBRL(discount), right - 12, y + 38, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Total', summaryX + 12, y + 60);
      doc.text(formatBRL(total), right - 12, y + 60, { align: 'right' });

      doc.save(`orcamento-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      alert(error.message || 'Nao foi possivel gerar o PDF agora.');
    } finally {
      setPdfLoading(false);
    }
  };

  const buildOrderPayload = ({ paymentStatus, paymentMethod }) => ({
    items: items.map((item) => ({
      slug: item.slug,
      quantity: item.quantity,
      unit_price: getItemPrice(item),
      selected_color: item.selected_color || null,
      selected_secondary_color: item.selected_secondary_color || null,
      name_personalizations: getNamePersonalizations(item),
      selected_sub_items: (item.selected_sub_items || []).map((subItem) => ({
        slug: subItem.slug || null,
        title: subItem.title,
        quantity: Number(subItem.quantity || 1),
        unit_price: Number(subItem.unit_price || 0),
        selected_color: subItem.selected_color || null,
        selected_secondary_color: subItem.selected_secondary_color || null,
      })),
    })),
    coupon: coupon?.code || null,
    payment_status: paymentStatus,
    payment_method: paymentMethod,
  });

  const handleCheckoutWhatsapp = async () => {
    const paymentStatus = 'pending';
    if (!whatsappNumber) {
      alert('Configure o numero de WhatsApp no painel para concluir este fluxo.');
      return;
    }

    setPendingLoading(true);
    setLoading(true);
    trackEvent({
      event_type: 'start_checkout',
      product_id: null,
      cta_name: 'checkout_whatsapp_pending',
      metadata_json: {
        value: total,
        currency: 'BRL',
        num_items: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        payment_status: paymentStatus,
        items_count: items.length,
        total,
      },
    }).catch(() => {});

    try {
      const order = await createOrder(buildOrderPayload({ paymentStatus: 'pending', paymentMethod: 'whatsapp' }));

      trackEvent({
        event_type: 'order_created',
        product_id: null,
        cta_name: 'order_created_checkout',
        metadata_json: {
          order_id: order.id,
          content_ids: items.map((item) => item.slug || String(item.id || '')).filter(Boolean),
          num_items: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          value: total,
          currency: 'BRL',
          payment_status: paymentStatus,
          total,
          items_count: items.length,
        },
      }).catch(() => {});

      const lines = items
        .map((item) => {
          const selectedSubItems = item.selected_sub_items || [];
          const details = selectedSubItems.length
            ? `\n  - ${selectedSubItems
              .map((subItem) => {
                const subItemColors = formatColors(subItem.selected_color, subItem.selected_secondary_color);
                return `${subItem.quantity}x ${subItem.title}${subItemColors ? ` (cor: ${subItemColors})` : ''}`;
              })
              .join('\n  - ')}`
            : '';
          const colorLabel = formatColors(item.selected_color, item.selected_secondary_color);
          const colorText = colorLabel ? ` (cor: ${colorLabel})` : '';
          const names = getNamePersonalizations(item);
          const namesText = names.some(Boolean)
            ? `\n  Textos por unidade:\n  - ${names.map((value, index) => `${index + 1}: ${value || '(sem texto)'}`).join('\n  - ')}`
            : '';
          const days = getDaysFromHours(getLineLeadHours(item));
          const unitPrice = getItemPrice(item);
          const lineSubtotal = unitPrice * Number(item.quantity || 0);
          return [
            `• Produto: ${item.title}${colorText}`,
            `  Qtd: ${item.quantity}`,
            `  Preco unitario: ${formatBRL(unitPrice)}`,
            `  Subtotal: ${formatBRL(lineSubtotal)}`,
            details ? `  Itens selecionados:\n  - ${selectedSubItems
              .map((subItem) => {
                const subItemColors = formatColors(subItem.selected_color, subItem.selected_secondary_color);
                return `${subItem.quantity}x ${subItem.title}${subItemColors ? ` (cor: ${subItemColors})` : ''}`;
              })
              .join('\n  - ')}` : null,
            namesText ? namesText.trimEnd() : null,
            `  Prazo estimado: ${days} dia(s) apos pagamento`,
          ].filter(Boolean).join('\n');
        })
        .join('\n\n');
      const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const statusText = 'PENDENTE';
      const proofLine = '';
      const customerLine = customerName.trim() ? `Cliente: ${customerName.trim()}\n` : '';
      const generatedAt = new Date().toLocaleString('pt-BR');
      const message = [
        '🛒 *Novo pedido - PLA Studio*',
        '',
        `Pedido: #${order.id}`,
        customerLine ? customerLine.trimEnd() : null,
        `Data/Hora: ${generatedAt}`,
        '',
        '*Itens do pedido:*',
        lines,
        '',
        '*Resumo*',
        `• Itens totais: ${totalItems}`,
        `• Subtotal: ${formatBRL(subtotal)}`,
        `• Desconto: ${formatBRL(discount)}`,
        `• Total geral: ${formatBRL(total)}`,
        `• Status: ${statusText}`,
        `• Prazo total estimado: ${totalLeadDays} dia(s) apos pagamento`,
        proofLine ? proofLine.trim() : null,
        '',
        'Observacao: Gostaria de finalizar este pedido.',
      ].filter(Boolean).join('\n');
      clearCart();
      trackEvent({
        event_type: 'whatsapp_click',
        product_id: null,
        cta_name: 'checkout_send_whatsapp',
        metadata_json: {
          order_id: order.id,
          content_name: 'checkout_whatsapp',
          content_ids: items.map((item) => item.slug || String(item.id || '')).filter(Boolean),
          num_items: totalItems,
          value: total,
          currency: 'BRL',
          payment_status: paymentStatus,
          total,
          total_items: totalItems,
        },
      }).catch(() => {});
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
      setPendingLoading(false);
      setLoading(false);
    }
  };

  const handleCheckoutOnline = async () => {
    setOnlineLoading(true);
    setLoading(true);
    trackEvent({
      event_type: 'start_checkout',
      product_id: null,
      cta_name: 'checkout_online_infinitepay',
      metadata_json: {
        value: total,
        currency: 'BRL',
        num_items: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        payment_status: 'pending_payment',
        payment_method: 'infinitepay',
      },
    }).catch(() => {});

    try {
      const order = await createOrder(buildOrderPayload({ paymentStatus: 'pending_payment', paymentMethod: 'pix' }));
      const checkout = await createInfinitePayCheckout({
        order_id: Number(order.id),
        customer_name: customerName || undefined,
      });
      if (!checkout?.checkout_url) {
        throw new Error('Checkout nao retornou URL de pagamento.');
      }
      window.location.href = checkout.checkout_url;
    } catch (error) {
      alert(error.message || 'Erro ao iniciar pagamento online.');
    } finally {
      setOnlineLoading(false);
      setLoading(false);
    }
  };

  const isWhatsappSelected = selectedCheckoutOption === 'whatsapp';
  const isPrimaryLoading = isWhatsappSelected ? pendingLoading : onlineLoading;
  const primaryButtonLabel = isWhatsappSelected ? 'Continuar no WhatsApp' : 'Ir para pagamento';
  const primaryButtonHelper = isWhatsappSelected
    ? 'Voce sera redirecionado para conversar no WhatsApp.'
    : 'Voce sera redirecionado para o pagamento seguro.';

  return (
    <section className="container cart-page-pro">
      <SectionHeader title="Carrinho" subtitle="Revise os itens antes de concluir" />

      {items.length === 0 ? (
        <EmptyState
          title="Seu carrinho esta vazio"
          description="Adicione produtos da vitrine para continuar"
          action={<Button onClick={() => navigate('/')}>Voltar para loja</Button>}
        />
      ) : (
        <div className="cart-layout-pro">
          <div className="cart-items-pro">
            {items.map((item) => (
              <Card key={getCartItemKey(item)} className="cart-item-pro">
                <div className="cart-item-image" style={{ backgroundImage: `url(${item.cover_image})` }} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.short_description}</p>
                  {item.selected_color || item.selected_secondary_color ? (
                    <p className="mb-1 text-xs text-slate-600">
                      <ColorPreview primary={item.selected_color} secondary={item.selected_secondary_color} />
                    </p>
                  ) : null}
                  {(item.selected_sub_items || []).length > 0 ? (
                    <div className="mb-2 space-y-1 text-xs text-slate-600">
                      {(item.selected_sub_items || []).map((subItem, index) => (
                        <div key={`${subItem.title}-${index}`} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span>{subItem.quantity}x {subItem.title}</span>
                            {subItem.selected_color || subItem.selected_secondary_color ? (
                              <ColorPreview primary={subItem.selected_color} secondary={subItem.selected_secondary_color} size={14} />
                            ) : null}
                          </span>
                          <strong>R$ {(Number(subItem.unit_price || 0) * Number(subItem.quantity || 0)).toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {getNamePersonalizations(item).some(Boolean) ? (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs text-emerald-700">
                      <p className="font-semibold">Textos para personalizacao:</p>
                      <ul className="mt-1 space-y-1">
                        {getNamePersonalizations(item).map((name, index) => (
                          <li key={`${getCartItemKey(item)}-name-${index}`}>Unidade {index + 1}: {name || '(sem texto)'}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mb-2 text-xs text-slate-500">
                    Prazo estimado: {getDaysFromHours(getLineLeadHours(item))} dia(s) apos confirmacao do pagamento
                  </p>
                  <div className="cart-item-controls">
                    <QuantitySelector value={item.quantity} onChange={(value) => updateQuantity(getCartItemKey(item), value)} />
                    <Button variant="ghost" onClick={() => removeItem(getCartItemKey(item))}>
                      Remover
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <strong className="cart-item-price">R$ {getItemPrice(item).toFixed(2)}</strong>
                  <p className="mt-1 text-xs text-slate-500">total: R$ {(getItemPrice(item) * item.quantity).toFixed(2)}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card className="cart-summary-pro">
            <h3>Resumo do pedido</h3>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>R$ {subtotal.toFixed(2)}</strong>
            </div>
            <div className={`summary-line ${discount > 0 ? 'text-emerald-600' : ''}`}>
              <span>Desconto</span>
              <strong className={discount > 0 ? 'text-emerald-600' : ''}>R$ {discount.toFixed(2)}</strong>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>R$ {total.toFixed(2)}</strong>
            </div>
            <div className="summary-line">
              <span>Prazo total estimado</span>
              <strong>{totalLeadDays} dia(s)</strong>
            </div>

            <Input label="Cupom" value={code} onChange={(event) => setCode(event.target.value)} placeholder="DESCONTO10" />
            <Input label="Seu nome (opcional)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Como gostaria de ser identificado no WhatsApp" />
            <Button variant="secondary" onClick={() => applyCoupon(code)}>
              Aplicar cupom
            </Button>
            {couponMessage ? <small className="helper-text">{couponMessage}</small> : null}

            <Button variant="secondary" loading={pdfLoading} onClick={handleDownloadQuotePdf}>
              Baixar orcamento em PDF
            </Button>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Como deseja finalizar seu pedido?</h4>
                <p className="mt-1 text-xs text-slate-600">
                  Escolha a forma mais conveniente para concluir sua compra.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Pagamento seguro</span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Atendimento direto</span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Processo rapido</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CheckoutOptionCard
                  accent="green"
                  selected={selectedCheckoutOption === 'whatsapp'}
                  onSelect={() => setSelectedCheckoutOption('whatsapp')}
                  icon={(
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 12a8 8 0 0 1-11.8 7L4 20l1-4.2A8 8 0 1 1 20 12Z" />
                      <path d="M9 9.5c.2 1.3 1.6 3 2.7 3.8 1 .8 2.2 1.2 3.3 1.2" />
                    </svg>
                  )}
                  title="Finalizar pelo WhatsApp"
                  description="Ideal para quem quer tirar duvidas, combinar detalhes, confirmar personalizacao e falar direto comigo."
                  benefits={[
                    'Tirar duvidas antes de comprar',
                    'Combinar personalizacoes',
                    'Atendimento rapido',
                  ]}
                />

                <CheckoutOptionCard
                  accent="violet"
                  selected={selectedCheckoutOption === 'online'}
                  onSelect={() => setSelectedCheckoutOption('online')}
                  icon={(
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" />
                      <path d="M3 10h18" />
                      <path d="M7 15h4" />
                    </svg>
                  )}
                  title="Pagar online"
                  description="Finalize com Pix ou cartao com pagamento rapido em um checkout seguro."
                  benefits={[
                    'Pagamento rapido e seguro',
                    'Pix ou cartao',
                    'Confirmacao automatica',
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  loading={isPrimaryLoading}
                  disabled={loading}
                  onClick={isWhatsappSelected ? handleCheckoutWhatsapp : handleCheckoutOnline}
                >
                  {primaryButtonLabel}
                </Button>
                <p className="text-center text-xs text-slate-500">{primaryButtonHelper}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

export default CartPage;
