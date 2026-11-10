
useEffect(() => {
  if (!supabase) {
    setLoading(false);
    return;
  }

  let active = true;

  const initialize = async () => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSession(session);
        setLoading(false);
      }
    });

    try {
      const { data: sessionData, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (active) {
        setSession(sessionData.session);
        setLoading(false);
      }
    } catch (error) {
      console.error('Authentication initialization failed:', error);

      if (active) {
        setSession(null);
        setLoading(false);
      }
    }
  };

  void initialize();

  return () => {
    active = false;
  };
}, []);
