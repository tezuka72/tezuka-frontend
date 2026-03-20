// Web: @stripe/stripe-react-native は web 非対応のためスタブを提供
export function StripeProvider({ children }) {
  return children;
}

export function useStripe() {
  return {
    confirmPayment: async () => ({ error: { message: 'Stripe is not supported on web' } }),
    initPaymentSheet: async () => ({ error: { message: 'Stripe is not supported on web' } }),
    presentPaymentSheet: async () => ({ error: { message: 'Stripe is not supported on web' } }),
  };
}
