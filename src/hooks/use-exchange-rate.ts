import { useState, useEffect } from "react";

/**
 * Fetches the current NZD to USD exchange rate from a free API.
 * Caches the rate for 1 hour in localStorage to avoid excessive API calls.
 */
export function useExchangeRate() {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check cache first
    const cached = localStorage.getItem("nzd_usd_rate");
    if (cached) {
      const { rate: cachedRate, timestamp } = JSON.parse(cached);
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - timestamp < oneHour) {
        setRate(cachedRate);
        return;
      }
    }

    setLoading(true);
    fetch("https://open.er-api.com/v6/latest/NZD")
      .then((res) => res.json())
      .then((data) => {
        if (data.rates?.USD) {
          const usdRate = data.rates.USD;
          setRate(usdRate);
          localStorage.setItem(
            "nzd_usd_rate",
            JSON.stringify({ rate: usdRate, timestamp: Date.now() })
          );
        }
      })
      .catch((err) => console.warn("Exchange rate fetch failed:", err))
      .finally(() => setLoading(false));
  }, []);

  return { rate, loading };
}
