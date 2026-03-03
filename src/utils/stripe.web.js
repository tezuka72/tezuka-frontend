// Web: Stripe はネイティブ専用のためスタブを提供

export const StripeProvider = ({ children }) => <>{children}</>;

export const useStripe = () => ({
  confirmPayment: async () => ({
    error: { message: 'お支払いはアプリ版のみ対応しています。' },
  }),
});
