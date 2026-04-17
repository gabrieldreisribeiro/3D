import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import { WHATSAPP_NUMBER } from '../config/endpoints';
import { createOrder, fetchPublicLogo, fetchPublicSettings, resolveAssetUrl } from '../services/api';
import { getLogoSizeConfig, getLogoSizeKey } from '../services/logoSettings';
import { useCart } from '../services/cart';

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
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPixBox, setShowPixBox] = useState(false);
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

  const pixKey = String(storeSettings.pix_key || '').trim();

  const formatPixField = (id, value) => {
    const content = String(value || '');
    return `${id}${String(content.length).padStart(2, '0')}${content}`;
  };

  const crc16 = (value) => {
    let crc = 0xffff;
    for (let i = 0; i < value.length; i += 1) {
      crc ^= value.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j += 1) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };

  const pixPayload = useMemo(() => {
    if (!pixKey) return '';
    const merchantAccountInfo = formatPixField(
      '26',
      `${formatPixField('00', 'BR.GOV.BCB.PIX')}${formatPixField('01', pixKey)}`
    );
    const payloadWithoutCrc = [
      formatPixField('00', '01'),
      formatPixField('01', '12'),
      merchantAccountInfo,
      formatPixField('52', '0000'),
      formatPixField('53', '986'),
      formatPixField('58', 'BR'),
      formatPixField('59', 'PLA STUDIO'),
      formatPixField('60', 'SAO PAULO'),
      formatPixField('62', formatPixField('05', '***')),
      '6304',
    ].join('');
    return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
  }, [pixKey]);

  const pixQrCodeUrl = useMemo(() => {
    if (!pixPayload) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(pixPayload)}`;
  }, [pixPayload]);

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
        const subtitle = colorLabel ? ` | Cores: ${colorLabel} | Entrega: ${deliveryDays} dia(s)` : ` | Entrega: ${deliveryDays} dia(s)`;
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

  const handleCheckout = async (paymentStatus) => {
    const isPaid = paymentStatus === 'paid';
    if (!whatsappNumber) {
      alert('Configure o numero de WhatsApp no painel para concluir este fluxo.');
      return;
    }

    if (isPaid && !pixKey) {
      alert('Configure a chave Pix no painel para enviar pedido com status pago.');
      return;
    }

    if (isPaid) setPaidLoading(true);
    else setPendingLoading(true);
    setLoading(true);

    try {
      const order = await createOrder({
        items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
        coupon: coupon?.code || null,
        payment_status: isPaid ? 'paid' : 'pending',
        payment_method: isPaid ? 'pix' : 'whatsapp',
      });

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
          const days = getDaysFromHours(getLineLeadHours(item));
          return `${item.quantity}x ${item.title}${colorText} - R$ ${getItemPrice(item).toFixed(2)}${details}\nPrazo estimado: ${days} dia(s) apos pagamento`;
        })
        .join('\n');
      const statusText = isPaid ? 'PAGO (Pix)' : 'PENDENTE';
      const proofLine = isPaid ? '\nComprovante: vou enviar em anexo nesta conversa.' : '';
      const message = `Ola! Novo pedido:\n${lines}\nPrazo estimado total: ${totalLeadDays} dia(s) apos pagamento\nSubtotal: R$ ${subtotal.toFixed(2)}\nDesconto: R$ ${discount.toFixed(2)}\nTotal: R$ ${total.toFixed(2)}\nStatus: ${statusText}${proofLine}\nCodigo do pedido: ${order.id}`;
      clearCart();
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
      if (isPaid) setPaidLoading(false);
      else setPendingLoading(false);
      setLoading(false);
    }
  };

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
                  {formatColors(item.selected_color, item.selected_secondary_color) ? (
                    <p className="mb-1 text-xs text-slate-600">Cor: {formatColors(item.selected_color, item.selected_secondary_color)}</p>
                  ) : null}
                  {(item.selected_sub_items || []).length > 0 ? (
                    <div className="mb-2 space-y-1 text-xs text-slate-600">
                      {(item.selected_sub_items || []).map((subItem, index) => (
                        <div key={`${subItem.title}-${index}`} className="flex items-center justify-between">
                          <span>
                            {subItem.quantity}x {subItem.title}
                            {formatColors(subItem.selected_color, subItem.selected_secondary_color)
                              ? ` - cor: ${formatColors(subItem.selected_color, subItem.selected_secondary_color)}`
                              : ''}
                          </span>
                          <strong>R$ {(Number(subItem.unit_price || 0) * Number(subItem.quantity || 0)).toFixed(2)}</strong>
                        </div>
                      ))}
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
            <Button variant="secondary" onClick={() => applyCoupon(code)}>
              Aplicar cupom
            </Button>
            {couponMessage ? <small className="helper-text">{couponMessage}</small> : null}

            <Button variant="secondary" loading={pdfLoading} onClick={handleDownloadQuotePdf}>
              Baixar orcamento em PDF
            </Button>

            <Button variant="secondary" onClick={() => setShowPixBox((current) => !current)}>
              {showPixBox ? 'Fechar pagamento Pix' : 'Pagar com Pix (QR Code)'}
            </Button>

            {showPixBox ? (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Escaneie o QR Code Pix com seu banco e depois envie o pedido como pago.</p>
                {pixQrCodeUrl ? (
                  <img src={pixQrCodeUrl} alt="QR Code Pix" className="mx-auto h-56 w-56 rounded-xl border border-slate-200 bg-white p-2" />
                ) : (
                  <p className="text-xs text-rose-600">Chave Pix nao configurada no painel.</p>
                )}
                {pixPayload ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500">Pix copia e cola:</p>
                    <textarea readOnly className="h-24 w-full rounded-[10px] border border-slate-200 bg-white p-2 text-[11px] text-slate-700" value={pixPayload} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {showPixBox ? (
              <Button loading={paidLoading} disabled={loading || !pixKey} onClick={() => handleCheckout('paid')}>
                Enviar pedido pago no WhatsApp
              </Button>
            ) : (
              <Button variant="ghost" loading={pendingLoading} disabled={loading} onClick={() => handleCheckout('pending')}>
                Enviar pedido pendente no WhatsApp
              </Button>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

export default CartPage;
