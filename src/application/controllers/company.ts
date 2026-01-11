import { getAppDataSource } from "@/infrastructure/database/app-data-source";
import { ExampleData } from "@/infrastructure/database/entities/example";
import { NextFunction, Request, Response } from "express";
import { Between } from "typeorm";

export async function addNewCompany(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { symbol } = req.params;
    const { startDate, endDate } = req.query;

    const stockDataRepo = getAppDataSource().getRepository(ExampleData);

    const startTimestamp = new Date(startDate as string).getTime();
    const endTimestamp = new Date(endDate as string).getTime();

    const stockData = await stockDataRepo.find({
      where: {
        symbol,
        timestamp: Between(startTimestamp, endTimestamp),
      },
      order: { timestamp: "ASC" },
    });

    if (stockData.length === 0) {
      return res.status(200).json({
        success: true,
        result: [],
      });
    }

    const groupedCandlesticks: any[] = [];

    let currentHourStart: number = stockData[0].timestamp;
    let openPrice: number = stockData[0].price;
    let highPrice: number = stockData[0].price;
    let lowPrice: number = stockData[0].price;
    let closePrice: number = stockData[0].price;
    let totalVolume: number = stockData[0].volume;

    for (const data of stockData) {
      const timeDifference = data.timestamp - currentHourStart;

      if (timeDifference >= 60 * 60 * 1000) { // 60 minutes in milliseconds
        // Push the completed candlestick for the current hour
        groupedCandlesticks.push({
          timestamp: currentHourStart,
          open: openPrice,
          high: highPrice,
          low: lowPrice,
          close: closePrice,
          volume: totalVolume,
        });

        // Start a new candlestick for the new hour
        currentHourStart = data.timestamp;
        openPrice = data.price;
        highPrice = data.price;
        lowPrice = data.price;
        closePrice = data.price;
        totalVolume = data.volume;
      } else {
        // Update the ongoing candlestick values
        highPrice = Math.max(highPrice, data.price);
        lowPrice = Math.min(lowPrice, data.price);
        closePrice = data.price;
        totalVolume += data.volume;
      }
    }

    // Push the last candlestick after the loop ends
    groupedCandlesticks.push({
      timestamp: currentHourStart,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
      volume: totalVolume,
    });

    return res.status(200).json({
      success: true,
      result: groupedCandlesticks,
    });

  } catch (error: any) {
    next(error);
  }
}