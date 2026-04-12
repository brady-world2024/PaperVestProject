package com.papervest.common.util;

import java.util.Locale;

public final class SymbolUtils {

	private SymbolUtils() {
	}

	public static String normalize(String symbol) {
		return symbol == null ? null : symbol.trim().toUpperCase(Locale.US);
	}
}
