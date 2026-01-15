import { Notification } from "@/types/notification";

export const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "message",
    title: "Pesan Baru dari Bot",
    message: "Hai! Pesanan Anda #12345 sudah dikonfirmasi dan sedang diproses.",
    sender: "Order Bot",
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 menit lalu
    isRead: false,
  },
  {
    id: "2",
    type: "alert",
    title: "Pengingat Jadwal",
    message: "Meeting dengan tim development dalam 30 menit lagi. Jangan lupa!",
    sender: "Reminder Bot",
    timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 menit lalu
    isRead: false,
  },
  {
    id: "3",
    type: "success",
    title: "Pembayaran Berhasil",
    message: "Transaksi sebesar Rp 150.000 telah berhasil diproses.",
    sender: "Payment Bot",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 jam lalu
    isRead: false,
  },
  {
    id: "4",
    type: "system",
    title: "Update Sistem",
    message: "Sistem akan melakukan maintenance pada pukul 02:00 WIB.",
    sender: "System Bot",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 jam lalu
    isRead: true,
  },
  {
    id: "5",
    type: "warning",
    title: "Peringatan Keamanan",
    message: "Login baru terdeteksi dari perangkat yang tidak dikenal.",
    sender: "Security Bot",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 jam lalu
    isRead: true,
  },
  {
    id: "6",
    type: "message",
    title: "Promo Spesial!",
    message: "Dapatkan diskon 20% untuk semua produk hari ini saja!",
    sender: "Promo Bot",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 jam lalu
    isRead: true,
  },
  {
    id: "7",
    type: "message",
    title: "Pengiriman Dalam Perjalanan",
    message: "Paket Anda sedang dalam perjalanan dan akan tiba besok.",
    sender: "Shipping Bot",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 hari lalu
    isRead: true,
  },
];
