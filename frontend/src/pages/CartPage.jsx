import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import { createOrder, fetchPublicLogo, resolveAssetUrl } from '../services/api';
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
  const [pdfLoading, setPdfLoading] = useState(false);
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
  const formatColors = (primary, secondary) => {
    const values = [primary, secondary].filter(Boolean);
    if (!values.length) return null;
    return values.join(' + ');
  };

  const formatBRL = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const getCartItemKey = (item) => item.cart_key || `${item.slug}::base`;

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
        const deliveryDays = getDaysFromHours(getItemLeadHours(item));
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

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const order = await createOrder({
        items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
        coupon: coupon?.code || null,
      });

      const number = import.meta.env.VITE_WHATSAPP_NUMBER;
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
          const days = getDaysFromHours(getItemLeadHours(item));
          return `${item.quantity}x ${item.title}${colorText} - R$ ${getItemPrice(item).toFixed(2)}${details}\nPrazo estimado: ${days} dia(s) apos pagamento`;
        })
        .join('\n');
      const message = `Ola! Novo pedido:\n${lines}\nSubtotal: R$ ${subtotal.toFixed(2)}\nDesconto: R$ ${discount.toFixed(2)}\nTotal: R$ ${total.toFixed(2)}\nCodigo do pedido: ${order.id}`;
      clearCart();
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
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
                    Prazo estimado: {getDaysFromHours(getItemLeadHours(item))} dia(s) apos confirmacao do pagamento
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

            <Input label="Cupom" value={code} onChange={(event) => setCode(event.target.value)} placeholder="DESCONTO10" />
            <Button variant="secondary" onClick={() => applyCoupon(code)}>
              Aplicar cupom
            </Button>
            {couponMessage ? <small className="helper-text">{couponMessage}</small> : null}

            <Button variant="secondary" loading={pdfLoading} onClick={handleDownloadQuotePdf}>
              Baixar orcamento em PDF
            </Button>

            <Button loading={loading} onClick={handleCheckout}>
              Finalizar pedido
            </Button>
          </Card>
        </div>
      )}
    </section>
  );
}

export default CartPage;
